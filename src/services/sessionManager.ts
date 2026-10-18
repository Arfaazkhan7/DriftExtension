import * as vscode from 'vscode';
import { DriftResult, SessionState } from '../types';

const STORAGE_KEY = 'driftDetection.session';

export class SessionManager {
  private currentSession: SessionState | undefined;

  constructor(private readonly workspaceState: vscode.Memento) {
    this.currentSession = this.workspaceState.get<SessionState>(STORAGE_KEY);
  }

  public getSession(): SessionState | undefined {
    return this.currentSession;
  }

  public async setSession(session: SessionState): Promise<void> {
    this.currentSession = {
      ...session,
      updatedAt: Date.now(),
    };
    await this.workspaceState.update(STORAGE_KEY, this.currentSession);
  }

  public async updateResult(result: DriftResult): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    this.currentSession.history = result.graph;
    this.currentSession.lastResult = result;
    this.currentSession.updatedAt = Date.now();
    await this.workspaceState.update(STORAGE_KEY, this.currentSession);
  }

  public async updateGoal(goal: string, description?: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    this.currentSession.goal = goal;
    if (description !== undefined) {
      this.currentSession.description = description;
    }
    this.currentSession.updatedAt = Date.now();
    await this.workspaceState.update(STORAGE_KEY, this.currentSession);
  }

  public async clearSession(): Promise<void> {
    this.currentSession = undefined;
    await this.workspaceState.update(STORAGE_KEY, undefined);
  }
}
