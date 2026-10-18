import { ChildProcess, spawn } from 'child_process';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AnalysisPayload, BackendProcessOptions, DriftResult } from '../types';

export class BackendProcessService {
  private activeProcess: ChildProcess | undefined;
  private activeTempDir: string | undefined;

  /**
   * Run the Python backend with the given payload, enforcing strict timeouts,
   * direct process execution (no shell), secure temp file isolation, and automatic cleanup.
   */
  public async execute(payload: AnalysisPayload, options: BackendProcessOptions): Promise<DriftResult> {
    // 1. Create a secure, uniquely named temporary directory
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'drift-run-'));
    this.activeTempDir = tempDir;
    const payloadFile = path.join(tempDir, 'payload.json');

    try {
      // 2. Write payload to temporary file with restrictive permissions (0o600)
      await fsp.writeFile(payloadFile, JSON.stringify(payload), {
        encoding: 'utf8',
        mode: 0o600,
      });

      // 3. Spawn Python process directly with arguments array (no shell: true)
      const args = [options.backendScriptPath, '--payload', payloadFile];
      const output = await this.spawnWithTimeout(options.pythonPath, args, options.cwd, options.timeoutMs);

      // 4. Parse and validate JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(output);
      } catch {
        throw new Error(`Backend returned invalid JSON. Output preview:\n${output.slice(0, 300)}`);
      }

      if (typeof parsed !== 'object' || parsed === null || !('score' in parsed) || !('status' in parsed)) {
        throw new Error(`Backend response is missing required fields. Output: ${JSON.stringify(parsed).slice(0, 200)}`);
      }

      return parsed as DriftResult;
    } finally {
      // 5. Always clean up temporary files and folder
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      if (this.activeTempDir === tempDir) {
        this.activeTempDir = undefined;
      }
    }
  }

  /**
   * Cancel the currently executing backend process, if any.
   */
  public cancel(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
        // Process might already be dead
      }
    }
  }

  /**
   * Clean up all resources upon extension deactivation.
   */
  public dispose(): void {
    this.cancel();
    if (this.activeTempDir) {
      void fsp.rm(this.activeTempDir, { recursive: true, force: true }).catch(() => undefined);
      this.activeTempDir = undefined;
    }
  }

  private spawnWithTimeout(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      let timer: NodeJS.Timeout | undefined;

      // Direct spawn without shell
      const child = spawn(command, args, {
        cwd,
        windowsHide: true,
        shell: false,
      });
      this.activeProcess = child;

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', chunk => {
        stderr += chunk.toString();
      });

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (this.activeProcess === child) {
          this.activeProcess = undefined;
        }
      };

      timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          try {
            child.kill('SIGTERM');
            // Hard kill after 1 second if still alive
            setTimeout(() => {
              try {
                child.kill('SIGKILL');
              } catch {
                // Ignore
              }
            }, 1000).unref();
          } catch {
            // Ignore
          }
          reject(new Error(`Backend analysis timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
        }
      }, timeoutMs);

      child.on('error', error => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(new Error(`Failed to start Python backend executable "${command}": ${error.message}`));
        }
      });

      child.on('close', (code, signal) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();

          if (signal === 'SIGTERM' || signal === 'SIGKILL') {
            reject(new Error('Backend analysis was cancelled.'));
            return;
          }

          if (code === 0) {
            resolve(stdout.trim());
          } else {
            const errorMsg = stderr.trim() || `Backend process exited with code ${code}`;
            reject(new Error(errorMsg));
          }
        }
      });
    });
  }
}
