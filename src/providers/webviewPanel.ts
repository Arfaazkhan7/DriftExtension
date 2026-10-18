import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionToWebviewMessage, SessionState, ThemeKind, WebviewToExtensionMessage } from '../types';
import { generateNonce, isPathInsideDirectory, sanitizeDescriptionInput, sanitizeGoalInput } from '../utils/security';

export interface WebviewPanelDelegate {
  onTriggerAnalysis: () => void;
  onRescanWorkspace: () => void;
  onEditGoal: () => void;
  onUpdateGoal: (goal: string, description: string) => Promise<void>;
  onPauseAnalysis: () => void;
  onResumeAnalysis: () => void;
  isAnalysisPaused: () => boolean;
  onRefreshDashboard: () => void;
  onReady: () => void;
}

export class DriftDashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private themeSubscription: vscode.Disposable | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly delegate?: WebviewPanelDelegate
  ) {}

  public show(session?: SessionState): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      if (session?.lastResult) {
        this.pushUpdate(session);
      }
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'driftDetection.dashboard',
      'Live Code Drift Detection AI',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'webview')),
        ],
      }
    );

    this.themeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
      this.postMessage({ type: 'themeChanged', kind: this.getThemeKind() });
    });

    this.panel.onDidDispose(() => {
      this.themeSubscription?.dispose();
      this.themeSubscription = undefined;
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleWebviewMessage(message, session);
    });

    this.panel.webview.html = this.buildHtml(this.panel.webview);
    if (session?.lastResult) {
      this.pushUpdate(session);
    }
  }

  public pushUpdate(session: SessionState, runId: number = Date.now()): void {
    if (!this.panel || !session.lastResult) {
      return;
    }

    const payload = {
      rootPath: session.rootPath,
      goal: session.goal,
      description: session.description,
      result: session.lastResult,
    };

    // Send both modern and legacy message types
    this.postMessage({
      type: 'analysisCompleted',
      runId,
      payload,
    });
    this.postMessage({
      type: 'analysis:update',
      payload,
    });
  }

  public postMessage(message: ExtensionToWebviewMessage): void {
    if (this.panel) {
      void this.panel.webview.postMessage(message);
    }
  }

  public isVisible(): boolean {
    return this.panel !== undefined && this.panel.visible;
  }

  public dispose(): void {
    this.themeSubscription?.dispose();
    this.themeSubscription = undefined;
    this.panel?.dispose();
    this.panel = undefined;
  }

  private getThemeKind(): ThemeKind {
    const kind = vscode.window.activeColorTheme.kind;
    if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
      return 'high-contrast';
    }
    if (kind === vscode.ColorThemeKind.Light) {
      return 'light';
    }
    return 'dark';
  }

  private buildHtml(webview: vscode.Webview): string {
    const webviewDir = path.join(this.context.extensionPath, 'webview');
    const htmlPath = path.join(webviewDir, 'panel.html');
    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'panel.js')));
    const nonce = generateNonce();

    // Restrictive Content Security Policy
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    return htmlContent
      .split('{{csp}}').join(csp)
      .split('{{styleUri}}').join(cssUri.toString())
      .split('{{scriptUri}}').join(scriptUri.toString())
      .split('{{nonce}}').join(nonce);
  }

  public async handleWebviewMessage(message: unknown, session?: SessionState): Promise<void> {
    if (typeof message !== 'object' || message === null) {
      return;
    }

    const msg = message as WebviewToExtensionMessage;

    switch (msg.type) {
      case 'ready':
        this.delegate?.onReady();
        this.postMessage({ type: 'themeChanged', kind: this.getThemeKind() });
        break;

      case 'requestAnalysis':
      case 'action:triggerAnalysis':
        this.delegate?.onTriggerAnalysis();
        break;

      case 'rescanWorkspace':
        this.delegate?.onRescanWorkspace();
        break;

      case 'pauseAnalysis':
        this.delegate?.onPauseAnalysis();
        break;

      case 'resumeAnalysis':
        this.delegate?.onResumeAnalysis();
        break;

      case 'updateGoal': {
        const goal = typeof msg.goal === 'string' ? sanitizeGoalInput(msg.goal) : '';
        const description = typeof msg.description === 'string' ? sanitizeDescriptionInput(msg.description) : '';
        if (goal.trim()) {
          await this.delegate?.onUpdateGoal(goal, description);
        } else {
          vscode.window.showWarningMessage('Goal cannot be empty.');
        }
        break;
      }

      case 'action:editGoal':
        this.delegate?.onEditGoal();
        break;

      case 'refreshDashboard':
        this.delegate?.onRefreshDashboard();
        break;

      case 'openFile':
      case 'openLocation':
      case 'action:openFile': {
        if (!session?.rootPath || typeof msg.path !== 'string') {
          return;
        }

        const rawPath = msg.path.trim();
        if (!rawPath) {
          return;
        }

        const targetPath = path.isAbsolute(rawPath)
          ? path.normalize(rawPath)
          : path.normalize(path.join(session.rootPath, rawPath));

        // Strict security check: ensure path is inside active workspace
        if (!isPathInsideDirectory(targetPath, session.rootPath) && targetPath !== session.rootPath) {
          vscode.window.showWarningMessage('Cannot open file: requested path escapes the active project workspace.');
          return;
        }

        if (!fs.existsSync(targetPath)) {
          vscode.window.showWarningMessage(`File not found: ${rawPath}`);
          return;
        }

        try {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
          const editor = await vscode.window.showTextDocument(doc);
          const lineNum = typeof msg.line === 'number' && msg.line > 0 ? msg.line : 1;
          const colNum = 'column' in msg && typeof msg.column === 'number' && msg.column > 0 ? msg.column : 1;

          const lineIndex = Math.min(doc.lineCount - 1, Math.max(0, lineNum - 1));
          const maxCol = doc.lineAt(lineIndex).text.length;
          const colIndex = Math.min(maxCol, Math.max(0, colNum - 1));

          const pos = new vscode.Position(lineIndex, colIndex);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to open "${rawPath}": ${String(err)}`);
        }
        break;
      }
    }
  }
}
