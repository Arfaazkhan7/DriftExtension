import assert from 'node:assert';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { BackendProcessService } from '../../src/services/backendProcess';
import { AnalysisPayload } from '../../src/types';

describe('BackendProcessService', () => {
  it('should clean up temp payload directory in finally block even on error', async () => {
    const service = new BackendProcessService();
    const payload: AnalysisPayload = {
      projectRoot: process.cwd(),
      goal: 'Test cleanup',
      description: '',
      history: [],
      filePaths: [],
    };

    const fakeScript = path.join(process.cwd(), 'non-existent-script.py');

    let thrown = false;
    try {
      await service.execute(payload, {
        pythonPath: 'python',
        backendScriptPath: fakeScript,
        timeoutMs: 5000,
        cwd: process.cwd(),
      });
    } catch {
      thrown = true;
    }

    assert.strictEqual(thrown, true, 'Execution should throw on missing script');

    const tempEntries = await fsp.readdir(os.tmpdir());
    const leftoverDirs = tempEntries.filter(name => name.startsWith('drift-run-'));
    assert.strictEqual(service['activeTempDir'], undefined, 'activeTempDir must be reset to undefined');
  });

  it('should reject when execution exceeds timeoutMs and cancel the process', async () => {
    const service = new BackendProcessService();
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'drift-test-timeout-'));
    const hangingScript = path.join(tempDir, 'hang.py');

    await fsp.writeFile(hangingScript, 'import time; time.sleep(10)');

    const payload: AnalysisPayload = {
      projectRoot: tempDir,
      goal: 'Test timeout',
      description: '',
      history: [],
      filePaths: [],
    };

    const startTime = Date.now();
    let errorMsg = '';
    try {
      await service.execute(payload, {
        pythonPath: 'python',
        backendScriptPath: hangingScript,
        timeoutMs: 1000, // 1 second timeout
        cwd: tempDir,
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }

    const elapsed = Date.now() - startTime;
    assert.match(errorMsg, /timed out after 1 seconds/i);
    assert.ok(elapsed < 4000, `Execution should abort near timeout (took ${elapsed}ms)`);
  });

  it('should reject with descriptive error if backend returns malformed JSON', async () => {
    const service = new BackendProcessService();
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'drift-test-json-'));
    const brokenScript = path.join(tempDir, 'broken.py');

    await fsp.writeFile(brokenScript, 'print("THIS IS NOT JSON AT ALL")');

    const payload: AnalysisPayload = {
      projectRoot: tempDir,
      goal: 'Test malformed json',
      description: '',
      history: [],
      filePaths: [],
    };

    let errorMsg = '';
    try {
      await service.execute(payload, {
        pythonPath: 'python',
        backendScriptPath: brokenScript,
        timeoutMs: 5000,
        cwd: tempDir,
      });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }

    assert.match(errorMsg, /invalid JSON/i);
  });
});
