import assert from 'node:assert';
import { describe, it } from 'node:test';
import { AnalysisQueue } from '../../src/services/analysisQueue';

describe('AnalysisQueue', () => {
  it('should coalesce multiple rapid requests within debounce window', async () => {
    let callCount = 0;
    const queue = new AnalysisQueue(
      async () => {
        callCount += 1;
      },
      { debounceMs: 50 }
    );

    queue.requestRun('Save 1');
    queue.requestRun('Save 2');
    queue.requestRun('Save 3');

    // Wait past debounce
    await new Promise(resolve => setTimeout(resolve, 100));

    assert.strictEqual(callCount, 1, 'Multiple rapid saves should coalesce into a single run');
    queue.dispose();
  });

  it('should queue a trailing run when a save occurs during active analysis', async () => {
    const executedRuns: Array<{ runId: number; reason: string }> = [];

    let resolveActiveRun: (() => void) | undefined;
    const queue = new AnalysisQueue(
      async (runId, reason) => {
        executedRuns.push({ runId, reason });
        if (executedRuns.length === 1) {
          // Keep first run active until we trigger the save during execution
          await new Promise<void>(resolve => {
            resolveActiveRun = resolve;
          });
        }
      },
      { debounceMs: 20 }
    );

    // Start first run asynchronously
    const firstRunPromise = queue.forceRun('First Manual Trigger');

    // Wait until runner has started
    while (executedRuns.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.strictEqual(queue.running, true, 'Queue should be marked running');

    // Trigger save while first run is in-flight
    queue.requestRun('Save during active run');
    await new Promise(resolve => setTimeout(resolve, 30));

    // Finish first run
    resolveActiveRun!();
    await firstRunPromise;

    // Allow trailing run to dispatch and finish
    await new Promise(resolve => setTimeout(resolve, 60));

    assert.strictEqual(executedRuns.length, 2, 'Trailing run should execute after active run completes');
    assert.strictEqual(executedRuns[0].reason, 'First Manual Trigger');
    assert.strictEqual(executedRuns[1].reason, 'Save during active run');
    assert.strictEqual(queue.running, false, 'Queue should be idle after trailing run');

    queue.dispose();
  });

  it('should increment runId monotonically and allow stale run detection', async () => {
    const runIds: number[] = [];
    const queue = new AnalysisQueue(
      async (runId) => {
        runIds.push(runId);
      },
      { debounceMs: 10 }
    );

    await queue.forceRun('Run A');
    await queue.forceRun('Run B');
    await queue.forceRun('Run C');

    assert.deepStrictEqual(runIds, [1, 2, 3]);
    assert.strictEqual(queue.activeRunId, 3);
    queue.dispose();
  });

  it('should reset isAnalyzing on error without leaving the queue stuck', async () => {
    let attempts = 0;
    const queue = new AnalysisQueue(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Simulated runner failure');
        }
      },
      { debounceMs: 10 }
    );

    try {
      await queue.forceRun('Failing Run');
    } catch {
      // Expected
    }

    assert.strictEqual(queue.running, false, 'Queue must not be stuck in running state after error');

    // Should succeed on next run
    await queue.forceRun('Recovered Run');
    assert.strictEqual(attempts, 2);
    assert.strictEqual(queue.running, false);

    queue.dispose();
  });
});
