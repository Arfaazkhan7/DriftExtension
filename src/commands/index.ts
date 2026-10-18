import * as vscode from 'vscode';
import { sanitizeDescriptionInput, sanitizeGoalInput } from '../utils/security';

export interface CommandControllerDelegate {
  startAnalysisWithFolder(rootUri: vscode.Uri, goal: string, description: string): Promise<void>;
  openDashboard(): void;
  editGoal(goal: string, description: string): Promise<void>;
  cancelAnalysis(): void;
  getActiveRootPath(): string | undefined;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  delegate: CommandControllerDelegate
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.commands.registerCommand('driftDetection.startAnalysis', async (targetUri?: vscode.Uri) => {
      let rootUri = targetUri;

      if (!rootUri) {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          if (vscode.workspace.workspaceFolders.length === 1) {
            rootUri = vscode.workspace.workspaceFolders[0].uri;
          } else {
            const picked = await vscode.window.showWorkspaceFolderPick({
              placeHolder: 'Select workspace folder for drift analysis',
            });
            if (picked) {
              rootUri = picked.uri;
            }
          }
        }
      }

      if (!rootUri) {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Select Project Folder',
        });
        if (selected && selected[0]) {
          rootUri = selected[0];
        }
      }

      if (!rootUri) {
        vscode.window.showErrorMessage('Please select a project folder before starting drift analysis.');
        return;
      }

      const goal = await vscode.window.showInputBox({
        title: 'Project Goal',
        prompt: 'Describe the primary goal or intended functionality of this project',
        placeHolder: 'Example: Build a task manager with reminders and analytics',
        ignoreFocusOut: true,
        validateInput: value => value.trim() ? undefined : 'Project goal is required.',
      });
      if (!goal) {
        return;
      }

      const description = await vscode.window.showInputBox({
        title: 'Project Description',
        prompt: 'Add an optional implementation description or architecture details',
        placeHolder: 'Example: React frontend, Node API, and PostgreSQL',
        ignoreFocusOut: true,
      });

      await delegate.startAnalysisWithFolder(
        rootUri,
        sanitizeGoalInput(goal),
        sanitizeDescriptionInput(description ?? '')
      );
    })
  );

  disposables.push(
    vscode.commands.registerCommand('driftDetection.openDashboard', () => {
      delegate.openDashboard();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('driftDetection.editGoal', async () => {
      if (!delegate.getActiveRootPath()) {
        vscode.window.showWarningMessage('No active drift analysis session. Start an analysis first.');
        return;
      }

      const goal = await vscode.window.showInputBox({
        title: 'Edit Project Goal',
        prompt: 'Update the primary goal of this project',
        ignoreFocusOut: true,
        validateInput: value => value.trim() ? undefined : 'Project goal is required.',
      });
      if (!goal) {
        return;
      }

      const description = await vscode.window.showInputBox({
        title: 'Edit Project Description',
        prompt: 'Update optional implementation details',
        ignoreFocusOut: true,
      });

      await delegate.editGoal(
        sanitizeGoalInput(goal),
        sanitizeDescriptionInput(description ?? '')
      );
    })
  );

  disposables.push(
    vscode.commands.registerCommand('driftDetection.cancelAnalysis', () => {
      delegate.cancelAnalysis();
    })
  );

  return disposables;
}
