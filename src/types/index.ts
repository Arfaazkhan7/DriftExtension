export type DriftStatus = 'Aligned' | 'Drifting' | 'Danger' | 'Insufficient Evidence';

export interface EnrichedFeature {
  id: string;
  name: string;
  description: string;
  status: 'implemented' | 'partial' | 'missing' | 'unverified';
  evidence: string[];
  files: string[];
  lines: number[];
  confidence: number;
  missing_details: string;
  next_action: string;
}

export interface CodeDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  snippet: string;
  suggested_fix: string;
}

export interface RiskFinding {
  category: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  confidence: number;
  suggested_correction: string;
}

export interface ScoreBreakdown {
  goal_lexical_similarity: number;
  identifier_alignment: number;
  library_import_alignment: number;
  feature_coverage: number;
  structural_richness: number;
  completion_score: number;
}

export interface DriftResult {
  schema_version?: string;
  score: number; // Primary alignment score (0.0 to 1.0)
  alignment_score?: number;
  drift_score?: number;
  status: DriftStatus;
  reason: string;
  why: string;
  score_breakdown?: ScoreBreakdown;
  project_categories?: string[];
  dominant_category?: string;
  features?: EnrichedFeature[];
  diagnostics?: CodeDiagnostic[];
  mentor_brief: string;
  project_summary: string;
  suggestion: string;
  suggestions: string[];
  action_plan: string[];
  risk: string;
  risk_level: string;
  risk_findings?: RiskFinding[];
  area: { UI: number; Backend: number; Logic: number };
  area_details: Array<{ path: string; area: string; weight: number }>;
  architecture: { type: string; languages: string[]; primary_files: string[]; dominant_area: string };
  feature_map: Array<{ feature: string; status: string; evidence: string[] }>;
  strengths: string[];
  readiness: { level: string; summary: string; signals: string[] };
  confidence: number;
  error_fix: { issue: string; fix: string; file: string; line: string; bad_code: string; fixed_code: string };
  graph: number[];
  top_matches: Array<{ path: string; score: number }>;
  file_reviews: Array<{ path: string; summary: string; alignment: string }>;
  file_count: number;
  missing_terms: string[];
  completion_score: number;
  coverage_score: number;
  completion_notes: string[];
  capabilities?: string[];
}

export interface SessionState {
  rootPath: string;
  goal: string;
  description: string;
  history: number[];
  lastResult?: DriftResult;
  updatedAt?: number;
}

export interface AnalysisPayload {
  projectRoot: string;
  goal: string;
  description: string;
  history: number[];
  filePaths: string[];
}

export interface BackendProcessOptions {
  pythonPath: string;
  backendScriptPath: string;
  timeoutMs: number;
  cwd: string;
}

export interface WebviewPayload {
  rootPath: string;
  goal: string;
  description: string;
  result: DriftResult;
}

export type ThemeKind = 'light' | 'dark' | 'high-contrast';

export type ExtensionToWebviewMessage =
  | { type: 'analysisStarted'; runId: number; reason: string }
  | { type: 'analysisProgress'; runId: number; progress?: number; message: string }
  | { type: 'analysisCompleted'; runId: number; payload: WebviewPayload }
  | { type: 'analysisFailed'; runId: number; error: string }
  | { type: 'analysisPaused'; isPaused: boolean; reason?: string }
  | { type: 'analysisResumed'; isPaused: boolean }
  | { type: 'workspaceChanged'; rootPath: string }
  | { type: 'goalUpdated'; goal: string; description: string }
  | { type: 'diagnosticsUpdated'; diagnostics: CodeDiagnostic[] }
  | { type: 'themeChanged'; kind: ThemeKind }
  | { type: 'analysis:update'; payload: WebviewPayload }
  | { type: 'analysis:status'; payload: { status: 'idle' | 'analyzing' | 'error'; message?: string } };

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'requestAnalysis' }
  | { type: 'rescanWorkspace' }
  | { type: 'pauseAnalysis' }
  | { type: 'resumeAnalysis' }
  | { type: 'updateGoal'; goal: string; description?: string }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'openLocation'; path: string; line?: number; column?: number }
  | { type: 'refreshDashboard' }
  | { type: 'action:openFile'; path: string; line?: number }
  | { type: 'action:triggerAnalysis' }
  | { type: 'action:editGoal' };
