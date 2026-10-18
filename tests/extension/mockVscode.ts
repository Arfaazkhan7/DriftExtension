import * as Module from 'module';

export interface MockWebviewPanel {
  visible: boolean;
  viewColumn: number;
  webview: {
    html: string;
    cspSource: string;
    asWebviewUri: (uri: any) => { toString: () => string };
    postMessage: (msg: any) => Promise<boolean>;
    onDidReceiveMessage: (cb: (msg: any) => Promise<void>) => { dispose: () => void };
    _triggerMessage: (msg: any) => Promise<void>;
    _postedMessages: any[];
  };
  reveal: (column?: number) => void;
  onDidDispose: (cb: () => void) => { dispose: () => void };
  dispose: () => void;
}

export const mockState = {
  activeThemeKind: 2, // Dark
  themeChangeListeners: [] as Array<() => void>,
  warningMessages: [] as string[],
  errorMessages: [] as string[],
  openedDocuments: [] as string[],
  revealedRanges: [] as any[],
  createdPanels: [] as MockWebviewPanel[],
  reset() {
    this.activeThemeKind = 2;
    this.themeChangeListeners = [];
    this.warningMessages = [];
    this.errorMessages = [];
    this.openedDocuments = [];
    this.revealedRanges = [];
    this.createdPanels = [];
  },
};

export const mockVscode = {
  ViewColumn: { Beside: 1, One: 1, Two: 2 },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
  TextEditorRevealType: { InCenter: 1 },
  Uri: {
    file(fsPath: string) {
      return { fsPath, toString: () => `file://${fsPath}` };
    },
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Selection: class {
    constructor(public anchor: any, public active: any) {}
  },
  Range: class {
    constructor(public start: any, public end: any) {}
  },
  window: {
    get activeColorTheme() {
      return { kind: mockState.activeThemeKind };
    },
    onDidChangeActiveColorTheme(listener: () => void) {
      mockState.themeChangeListeners.push(listener);
      return {
        dispose: () => {
          const idx = mockState.themeChangeListeners.indexOf(listener);
          if (idx !== -1) mockState.themeChangeListeners.splice(idx, 1);
        },
      };
    },
    showWarningMessage(msg: string) {
      mockState.warningMessages.push(msg);
      return Promise.resolve(undefined);
    },
    showErrorMessage(msg: string) {
      mockState.errorMessages.push(msg);
      return Promise.resolve(undefined);
    },
    createWebviewPanel(viewType: string, title: string, viewColumn: number, options: any): MockWebviewPanel {
      let messageCallback: ((msg: any) => Promise<void>) | undefined;
      const posted: any[] = [];
      const panel: MockWebviewPanel = {
        visible: true,
        viewColumn,
        webview: {
          html: '',
          cspSource: 'vscode-webview:',
          asWebviewUri: (uri: any) => ({ toString: () => `vscode-resource://${uri.fsPath || uri}` }),
          postMessage: async (msg: any) => {
            posted.push(msg);
            return true;
          },
          onDidReceiveMessage: (cb) => {
            messageCallback = cb;
            return { dispose: () => { messageCallback = undefined; } };
          },
          _triggerMessage: async (msg: any) => {
            if (messageCallback) await messageCallback(msg);
          },
          _postedMessages: posted,
        },
        reveal: (col?: number) => { panel.viewColumn = col || panel.viewColumn; panel.visible = true; },
        onDidDispose: (cb) => ({ dispose: cb }),
        dispose: () => { panel.visible = false; },
      };
      mockState.createdPanels.push(panel);
      return panel;
    },
    showTextDocument(doc: any) {
      mockState.openedDocuments.push(doc.uri.fsPath);
      return Promise.resolve({
        document: doc,
        selection: null,
        revealRange: (range: any, type: any) => {
          mockState.revealedRanges.push({ range, type });
        },
      });
    },
  },
  workspace: {
    openTextDocument(uri: any) {
      return Promise.resolve({
        uri,
        lineCount: 100,
        lineAt: (line: number) => ({ text: 'sample line content for testing length' }),
      });
    },
  },
};

const anyModule = Module as any;
const origRequire = anyModule.prototype.require;
anyModule.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return origRequire.apply(this, arguments);
};
