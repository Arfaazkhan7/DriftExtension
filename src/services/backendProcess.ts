import { ChildProcess, spawn } from 'child_process';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AnalysisPayload, BackendProcessOptions, DriftResult } from '../types';

export class BackendProcessService {
  private activeProcess: ChildProcess | undefined;
  private activeTempDir: string | undefined;

  public async execute(payload: AnalysisPayload, options: BackendProcessOptions): Promise<DriftResult> {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'drift-run-'));
    this.activeTempDir = tempDir;
    const payloadFile = path.join(tempDir, 'payload.json');

    try {
      await fsp.writeFile(payloadFile, JSON.stringify(payload), {
        encoding: 'utf8',
        mode: 0o600,
      });

      const args = [options.backendScriptPath, '--payload', payloadFile];
      const output = await this.spawnWithTimeout(options.pythonPath, args, options.cwd, options.timeoutMs);

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
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      if (this.activeTempDir === tempDir) {
        this.activeTempDir = undefined;
      }
    }
  }

  public cancel(): void {
    if (this.activeProcess && !this.activeProcess.killed) {
      try {
        this.activeProcess.kill('SIGTERM');
      } catch {
      }
    }
  }

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
            setTimeout(() => {
              try {
                child.kill('SIGKILL');
              } catch {
              }
            }, 1000).unref();
          } catch {
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
