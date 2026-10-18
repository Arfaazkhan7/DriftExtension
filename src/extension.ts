import * as path from 'path';
import * as vscode from 'vscode';
import { CommandControllerDelegate, registerCommands } from './commands';
import { DriftDashboardPanel, WebviewPanelDelegate } from './providers/webviewPanel';
import { AnalysisQueue } from './services/analysisQueue';
import { BackendProcessService } from './services/backendProcess';
import { FileCollector } from './services/fileCollector';
import { SessionManager } from './services/sessionManager';
import { DriftResult, SessionState } from './types';
import { isPathInsideDirectory } from './utils/security';

export class DriftController implements CommandControllerDelegate, WebviewPanelDelegate {
  private readonly sessionManager: SessionManager;
  private readonly backendService: BackendProcessService;
  private readonly fileCollector: FileCollector;
  private readonly dashboard: DriftDashboardPanel;
  private readonly analysisQueue: AnalysisQueue;
  private readonly statusBar: vscode.StatusBarItem;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.sessionManager = new SessionManager(context.workspaceState);
    this.backendService = new BackendProcessService();
    this.fileCollector = new FileCollector();
    this.dashboard = new DriftDashboardPanel(context, this);

    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = 'driftDetection.openDashboard';
    this.statusBar.text = '$(pulse) Drift AI: idle';
    this.statusBar.show();

    this.outputChannel = vscode.window.createOutputChannel('Drift AI');
    context.subscriptions.push(this.statusBar, this.outputChannel);

    this.analysisQueue = new AnalysisQueue(
      (runId, reason) => this.runAnalysis(runId, reason),
      { debounceMs: 400 }
    );

    const existingSession = this.sessionManager.getSession();
    if (existingSession?.lastResult) {
      this.statusBar.text = `$(pulse) Drift AI: ${existingSession.lastResult.status} ${Math.round(existingSession.lastResult.score * 100)}%`;
    }
  }

  public async startAnalysisWithFolder(rootUri: vscode.Uri, goal: string, description: string): Promise<void> {
    const session: SessionState = {
      rootPath: rootUri.fsPath,
      goal,
      description,
      history: [],
    };

    await this.sessionManager.setSession(session);
    this.dashboard.show(session);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Scanning project for initial drift baseline...', cancellable: true },
      async (_, token) => {
        token.onCancellationRequested(() => {
          this.cancelAnalysis();
        });
        await this.analysisQueue.forceRun('Initial project scan');
      }
    );
  }

  public openDashboard(): void {
    const session = this.sessionManager.getSession();
    this.dashboard.show(session);
  }

  public async editGoal(goal: string, description: string): Promise<void> {
    await this.sessionManager.updateGoal(goal, description);
    const session = this.sessionManager.getSession();
    if (session) {
      this.dashboard.pushUpdate(session);
      await this.analysisQueue.forceRun('Goal updated');
    }
  }

  private isAutoScanPaused = false;

  public cancelAnalysis(): void {
    this.backendService.cancel();
    this.statusBar.text = '$(circle-slash) Drift AI: cancelled';
    this.dashboard.postMessage({
      type: 'analysisFailed',
      runId: this.analysisQueue.activeRunId,
      error: 'Analysis cancelled by user.',
    });
  }

  public getActiveRootPath(): string | undefined {
    return this.sessionManager.getSession()?.rootPath;
  }

  public onTriggerAnalysis(): void {
    void this.analysisQueue.forceRun('Manual trigger from dashboard');
  }

  public onRescanWorkspace(): void {
    void this.analysisQueue.forceRun('Manual rescan from dashboard');
  }

  public onEditGoal(): void {
    void vscode.commands.executeCommand('driftDetection.editGoal');
  }

  public async onUpdateGoal(goal: string, description: string): Promise<void> {
    await this.editGoal(goal, description);
  }

  public onPauseAnalysis(): void {
    this.isAutoScanPaused = true;
    this.statusBar.text = '$(debug-pause) Drift AI: paused';
    this.dashboard.postMessage({
      type: 'analysisPaused',
      isPaused: true,
      reason: 'Automatic analysis on file save is paused. Manual rescan is still available.',
    });
  }

  public onResumeAnalysis(): void {
    this.isAutoScanPaused = false;
    const session = this.sessionManager.getSession();
    if (session?.lastResult) {
      this.statusBar.text = `$(pulse) Drift AI: ${session.lastResult.status} ${Math.round(session.lastResult.score * 100)}%`;
    } else {
      this.statusBar.text = '$(pulse) Drift AI: idle';
    }
    this.dashboard.postMessage({
      type: 'analysisResumed',
      isPaused: false,
    });
  }

  public isAnalysisPaused(): boolean {
    return this.isAutoScanPaused;
  }

  public onRefreshDashboard(): void {
    const session = this.sessionManager.getSession();
    if (session?.lastResult) {
      this.dashboard.pushUpdate(session);
    }
    if (this.isAutoScanPaused) {
      this.dashboard.postMessage({
        type: 'analysisPaused',
        isPaused: true,
        reason: 'Automatic analysis on file save is paused.',
      });
    }
  }

  public onReady(): void {
    const session = this.sessionManager.getSession();
    if (session?.lastResult) {
      this.dashboard.pushUpdate(session);
    }
    if (this.isAutoScanPaused) {
      this.dashboard.postMessage({
        type: 'analysisPaused',
        isPaused: true,
        reason: 'Automatic analysis on file save is paused.',
      });
    }
  }

  public handleSave(document: vscode.TextDocument): void {
    if (this.isAutoScanPaused) {
      return;
    }

    const session = this.sessionManager.getSession();
    if (!session?.rootPath) {
      return;
    }

    const config = vscode.workspace.getConfiguration('driftDetection');
    const autoAnalyze = config.get<boolean>('autoAnalyzeOnSave', true);
    if (!autoAnalyze) {
      return;
    }

    if (!isPathInsideDirectory(document.uri.fsPath, session.rootPath)) {
      return;
    }

    this.analysisQueue.requestRun(`Saved ${path.basename(document.uri.fsPath)}`);
  }

  public dispose(): void {
    this.analysisQueue.dispose();
    this.backendService.dispose();
    this.dashboard.dispose();
    this.statusBar.dispose();
    this.outputChannel.dispose();
  }

  private async runAnalysis(runId: number, reason: string): Promise<void> {
    const session = this.sessionManager.getSession();
    if (!session) {
      return;
    }

    this.statusBar.text = '$(sync~spin) Drift AI: analyzing...';
    this.dashboard.postMessage({
      type: 'analysisStarted',
      runId,
      reason,
    });
    this.dashboard.postMessage({
      type: 'analysis:status',
      payload: { status: 'analyzing', message: reason },
    });

    try {
      const config = vscode.workspace.getConfiguration('driftDetection');
      const pythonPath = config.get<string>('pythonPath', 'python');
      const timeoutMs = config.get<number>('backendTimeout', 30000);
      const backendScriptPath = path.join(this.context.extensionPath, 'backend', 'main.py');

      this.dashboard.postMessage({
        type: 'analysisProgress',
        runId,
        progress: 20,
        message: 'Collecting workspace source files...',
      });

      const filePaths = await this.fileCollector.collectFiles(session.rootPath);

      if (runId !== this.analysisQueue.activeRunId) {
        return;
      }

      this.dashboard.postMessage({
        type: 'analysisProgress',
        runId,
        progress: 50,
        message: `Analyzing ${filePaths.length} files with Python AI engine...`,
      });

      const payload = {
        projectRoot: session.rootPath,
        goal: session.goal,
        description: session.description,
        history: session.history,
        filePaths,
      };

      const result: DriftResult = await this.backendService.execute(payload, {
        pythonPath,
        backendScriptPath,
        timeoutMs,
        cwd: session.rootPath,
      });

      if (runId !== this.analysisQueue.activeRunId) {
        return;
      }

      await this.sessionManager.updateResult(result);
      const updatedSession = this.sessionManager.getSession();
      if (updatedSession) {
        this.dashboard.pushUpdate(updatedSession, runId);
        if (result.diagnostics && result.diagnostics.length > 0) {
          this.dashboard.postMessage({
            type: 'diagnosticsUpdated',
            diagnostics: result.diagnostics,
          });
        }
        this.statusBar.text = `$(pulse) Drift AI: ${result.status} ${Math.round(result.score * 100)}%`;
        vscode.window.setStatusBarMessage(`Drift status: ${result.status} (${Math.round(result.score * 100)}%)`, 4000);
      }
    } catch (error) {
      if (runId === this.analysisQueue.activeRunId) {
        const message = error instanceof Error ? error.message : String(error);
        this.statusBar.text = '$(warning) Drift AI: error';
        this.outputChannel.appendLine(`[Drift AI Analysis Error - ${new Date().toISOString()}] ${message}`);
        this.dashboard.postMessage({
          type: 'analysisFailed',
          runId,
          error: message,
        });
        this.dashboard.postMessage({
          type: 'analysis:status',
          payload: { status: 'error', message },
        });
        vscode.window.showErrorMessage(`Live Code Drift Detection AI failed: ${message}`);
      }
    }
  }
}

let controller: DriftController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  controller = new DriftController(context);

  const commandDisposables = registerCommands(context, controller);
  context.subscriptions.push(...commandDisposables);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      controller?.handleSave(document);
    })
  );
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
