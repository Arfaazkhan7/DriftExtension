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

  public async forceRun(reason: string): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    await this.dispatch(reason);
  }

  public get running(): boolean {
    return this.isAnalyzing;
  }

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

      if (this.pendingRequest) {
        const next = this.pendingRequest;
        this.pendingRequest = null;
        void this.dispatch(next.reason);
      }
    }
  }
}
