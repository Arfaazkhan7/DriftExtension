import './mockVscode'; // must be first to hook require('vscode')
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { DriftDashboardPanel, WebviewPanelDelegate } from '../../src/providers/webviewPanel';
import { SessionState } from '../../src/types';
import { mockState } from './mockVscode';

describe('Webview Two-Way Messaging & Security', () => {
  let tempWorkspace: string;
  let testFile: string;
  let panel: DriftDashboardPanel;
  let delegateCalls: {
    triggerCount: number;
    rescanCount: number;
    editGoalCount: number;
    updatedGoals: Array<{ goal: string; desc: string }>;
    pauseCount: number;
    resumeCount: number;
    refreshCount: number;
    readyCount: number;
    isPaused: boolean;
  };
  let mockDelegate: WebviewPanelDelegate;
  let fakeContext: any;

  beforeEach(() => {
    mockState.reset();
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-test-ws-'));
    testFile = path.join(tempWorkspace, 'src', 'main.py');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, 'print("hello world")\n');

    delegateCalls = {
      triggerCount: 0,
      rescanCount: 0,
      editGoalCount: 0,
      updatedGoals: [],
      pauseCount: 0,
      resumeCount: 0,
      refreshCount: 0,
      readyCount: 0,
      isPaused: false,
    };

    mockDelegate = {
      onTriggerAnalysis: () => { delegateCalls.triggerCount++; },
      onRescanWorkspace: () => { delegateCalls.rescanCount++; },
      onEditGoal: () => { delegateCalls.editGoalCount++; },
      onUpdateGoal: async (goal: string, desc: string) => {
        delegateCalls.updatedGoals.push({ goal, desc });
      },
      onPauseAnalysis: () => {
        delegateCalls.pauseCount++;
        delegateCalls.isPaused = true;
      },
      onResumeAnalysis: () => {
        delegateCalls.resumeCount++;
        delegateCalls.isPaused = false;
      },
      isAnalysisPaused: () => delegateCalls.isPaused,
      onRefreshDashboard: () => { delegateCalls.refreshCount++; },
      onReady: () => { delegateCalls.readyCount++; },
    };

    fakeContext = {
      extensionPath: path.resolve(__dirname, '../../..'),
    };

    panel = new DriftDashboardPanel(fakeContext, mockDelegate);
  });

  it('should ignore invalid and malformed messages safely', async () => {
    await panel.handleWebviewMessage(null);
    await panel.handleWebviewMessage(undefined);
    await panel.handleWebviewMessage('invalid-string');
    await panel.handleWebviewMessage(42);
    await panel.handleWebviewMessage({});
    await panel.handleWebviewMessage({ type: 'unknown_action' });

    assert.strictEqual(delegateCalls.rescanCount, 0);
    assert.strictEqual(delegateCalls.triggerCount, 0);
    assert.strictEqual(mockState.errorMessages.length, 0);
  });

  it('should handle lifecycle controls: ready, rescan, pause, resume, refresh', async () => {
    const session: SessionState = {
      rootPath: tempWorkspace,
      goal: 'Build test app',
      description: 'Test description',
      history: [],
    };

    await panel.handleWebviewMessage({ type: 'ready' }, session);
    assert.strictEqual(delegateCalls.readyCount, 1, 'ready should invoke onReady');

    await panel.handleWebviewMessage({ type: 'rescanWorkspace' }, session);
    assert.strictEqual(delegateCalls.rescanCount, 1, 'rescanWorkspace should invoke onRescanWorkspace');

    await panel.handleWebviewMessage({ type: 'pauseAnalysis' }, session);
    assert.strictEqual(delegateCalls.pauseCount, 1, 'pauseAnalysis should invoke onPauseAnalysis');
    assert.strictEqual(delegateCalls.isPaused, true);

    await panel.handleWebviewMessage({ type: 'resumeAnalysis' }, session);
    assert.strictEqual(delegateCalls.resumeCount, 1, 'resumeAnalysis should invoke onResumeAnalysis');
    assert.strictEqual(delegateCalls.isPaused, false);

    await panel.handleWebviewMessage({ type: 'refreshDashboard' }, session);
    assert.strictEqual(delegateCalls.refreshCount, 1, 'refreshDashboard should invoke onRefreshDashboard');
  });

  it('should validate and sanitize goal updates', async () => {
    const session: SessionState = {
      rootPath: tempWorkspace,
      goal: 'Old goal',
      description: '',
      history: [],
    };

    // Valid goal update
    await panel.handleWebviewMessage({
      type: 'updateGoal',
      goal: 'New Project Goal',
      description: 'New Description',
    }, session);

    assert.strictEqual(delegateCalls.updatedGoals.length, 1);
    assert.strictEqual(delegateCalls.updatedGoals[0].goal, 'New Project Goal');
    assert.strictEqual(delegateCalls.updatedGoals[0].desc, 'New Description');

    // Empty goal should trigger warning and not update
    await panel.handleWebviewMessage({
      type: 'updateGoal',
      goal: '   ',
      description: '',
    }, session);

    assert.strictEqual(delegateCalls.updatedGoals.length, 1, 'Should not add empty goal');
    assert.ok(mockState.warningMessages.some(m => m.includes('Goal cannot be empty')));
  });

  it('should open valid files within workspace boundaries with line and column', async () => {
    const session: SessionState = {
      rootPath: tempWorkspace,
      goal: 'Test',
      description: '',
      history: [],
    };

    // Open relative path inside workspace
    await panel.handleWebviewMessage({
      type: 'openLocation',
      path: path.join('src', 'main.py'),
      line: 1,
      column: 1,
    }, session);

    assert.strictEqual(mockState.openedDocuments.length, 1);
    assert.strictEqual(path.normalize(mockState.openedDocuments[0]), path.normalize(testFile));
    assert.strictEqual(mockState.revealedRanges.length, 1);
  });

  it('should strictly reject path traversal attacks that escape workspace', async () => {
    const session: SessionState = {
      rootPath: tempWorkspace,
      goal: 'Test',
      description: '',
      history: [],
    };

    // Attempt to access parent directory outside workspace
    await panel.handleWebviewMessage({
      type: 'openFile',
      path: '../../../../etc/passwd',
      line: 1,
    }, session);

    assert.strictEqual(mockState.openedDocuments.length, 0, 'Escaped path should not be opened');
    assert.ok(mockState.warningMessages.some(m => m.includes('escapes the active project workspace')));
  });

  it('should handle non-existent files gracefully without crashing', async () => {
    const session: SessionState = {
      rootPath: tempWorkspace,
      goal: 'Test',
      description: '',
      history: [],
    };

    await panel.handleWebviewMessage({
      type: 'openFile',
      path: 'non_existent_file.py',
      line: 10,
    }, session);

    assert.strictEqual(mockState.openedDocuments.length, 0);
    assert.ok(mockState.warningMessages.some(m => m.includes('File not found')));
  });

  it('should deliver two-way messages and notify theme changes', () => {
    panel.show();
    assert.strictEqual(mockState.createdPanels.length, 1);
    const mockPanel = mockState.createdPanels[0];

    // Verify initial ready handshake triggers theme notice
    mockState.activeThemeKind = 1; // Light
    if (mockState.themeChangeListeners.length > 0) {
      mockState.themeChangeListeners[0]();
    }

    const messages = mockPanel.webview._postedMessages;
    assert.ok(messages.some(m => m.type === 'themeChanged' && m.kind === 'light'));

    // High contrast theme notice
    mockState.activeThemeKind = 3; // HighContrast
    if (mockState.themeChangeListeners.length > 0) {
      mockState.themeChangeListeners[0]();
    }
    assert.ok(messages.some(m => m.type === 'themeChanged' && m.kind === 'high-contrast'));

    // Push update delivers both analysisCompleted and analysis:update
    const dummyResult: any = {
      status: 'Aligned',
      score: 0.85,
      features: [],
    };
    panel.pushUpdate({
      rootPath: tempWorkspace,
      goal: 'Test Goal',
      description: '',
      history: [],
      lastResult: dummyResult,
    }, 12345);

    assert.ok(messages.some(m => m.type === 'analysisCompleted' && m.runId === 12345));
    assert.ok(messages.some(m => m.type === 'analysis:update'));
  });
});
