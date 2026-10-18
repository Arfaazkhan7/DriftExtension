export type AnalysisRunner = (runId: number, reason: string) => Promise<void>;

export interface AnalysisQueueOptions {
  debounceMs?: number;
}

export class AnalysisQueue {
  private isAnalyzing = false;
  private pendingRequest: { reason: string } | null = null;
  private currentRunId = 0;
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly debounceMs: number;

  constructor(
    private readonly runner: AnalysisRunner,
    options?: AnalysisQueueOptions
  ) {
    this.debounceMs = options?.debounceMs ?? 400;
  }

  /**
   * Request an analysis run, typically triggered by a file save.
   * Multiple calls within debounceMs are coalesced into a single run.
   */
  public requestRun(reason: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.dispatch(reason);
    }, this.debounceMs);
  }

  /**
   * Immediately trigger an analysis run without debouncing (e.g. user manually clicked analyze).
   */
  public async forceRun(reason: string): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    await this.dispatch(reason);
  }

  /**
   * Check if an analysis is currently executing.
   */
  public get running(): boolean {
    return this.isAnalyzing;
  }

  /**
   * Get the current active run ID.
   */
  public get activeRunId(): number {
    return this.currentRunId;
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.pendingRequest = null;
    this.isAnalyzing = false;
  }

  private async dispatch(reason: string): Promise<void> {
    // If already analyzing, queue this as a trailing-edge request
    if (this.isAnalyzing) {
      this.pendingRequest = { reason };
      return;
    }

    this.isAnalyzing = true;
    this.currentRunId += 1;
    const runId = this.currentRunId;

    try {
      await this.runner(runId, reason);
    } finally {
      this.isAnalyzing = false;

      // Trailing edge: if a save occurred while the analysis was running,
      // dispatch a fresh analysis immediately with the latest workspace state.
      if (this.pendingRequest) {
        const next = this.pendingRequest;
        this.pendingRequest = null;
        void this.dispatch(next.reason);
      }
    }
  }
}
