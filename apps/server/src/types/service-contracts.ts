import type {
  QuestionRecord,
  SessionHistoryRecord,
  SessionRecord
} from '@ai3d/shared/types';

type ProjectLike = Record<string, unknown> & {
  id?: string;
  name?: string;
  dsl?: unknown;
  currentVersion?: unknown;
};

export interface ProjectServiceContract {
  initialize(): Promise<void>;
  listProjects(): Promise<ProjectLike[]>;
  createProject(input: { name?: string; description?: string }): Promise<ProjectLike>;
  getProject(projectId: string): Promise<ProjectLike>;
  listDslVersions(projectId: string): Promise<unknown[]>;
  getDslVersion(projectId: string, versionId: string): Promise<unknown>;
  saveDsl(projectId: string, dslInput: unknown, options?: { source?: string }): Promise<ProjectLike>;
  patchDsl(projectId: string, operations: unknown[]): Promise<ProjectLike>;
  getExportBundle(projectId: string): Promise<unknown>;
}

export interface AiSessionServiceContract {
  createOrGetActiveSession(projectId: string, mode?: string): Promise<SessionRecord>;
  getSession(projectId: string, sessionId: string): Promise<SessionRecord>;
  listHistory(
    projectId: string,
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SessionHistoryRecord>;
  createQuestion(
    sessionId: string,
    payload: { prompt: string; options?: string[] }
  ): Promise<QuestionRecord>;
  resolveQuestion(
    sessionId: string,
    questionId: string,
    payload: { actor?: string; selectedOption: string; rationale?: string }
  ): Promise<QuestionRecord>;
  appendMessage(sessionId: string, role: string, content: unknown): Promise<unknown>;
  markSessionStatus(sessionId: string, status: string, lastError?: string | null): Promise<void>;
  addCheckpoint(sessionId: string, nodeName: string, graphState: unknown): Promise<void>;
}

export interface AiStreamServiceContract {
  emit(sessionId: string, event: string, payload: unknown): string | null;
  subscribe(sessionId: string, reply: unknown): () => void;
  heartbeat(sessionId: string): void;
}

export interface AiProviderServiceContract {
  describe(): unknown;
  generateDsl(input: { prompt?: string; currentDsl?: unknown }): Promise<unknown>;
  streamChat(input: { messages: unknown[]; onToken: (delta: string) => void }): Promise<string>;
}

export interface AiOrchestratorServiceContract {
  runTurn(input: {
    projectId: string;
    sessionId: string;
    mode?: string;
    userMessage?: string;
    emit?: (event: string, payload: unknown) => void;
  }): Promise<unknown>;
  continueFromDecision(input: {
    projectId: string;
    sessionId: string;
    questionId: string;
    selectedOption: string;
    rationale?: string;
    emit?: (event: string, payload: unknown) => void;
  }): Promise<unknown>;
}

export interface ExportServiceContract {
  exportProjectAsZip(projectId: string): Promise<unknown>;
}

export interface AssetRegistryServiceContract {
  initialize(): Promise<void>;
  getAsset(assetId: string): Promise<unknown | null>;
  search(input?: { q?: string; tags?: string[] }): Promise<unknown[]>;
}

export interface PostgresServiceContract {
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface AppServices {
  projectService: ProjectServiceContract;
  assetRegistryService: AssetRegistryServiceContract;
  aiProviderService: AiProviderServiceContract;
  aiSessionService: AiSessionServiceContract;
  aiStreamService: AiStreamServiceContract;
  aiOrchestratorService: AiOrchestratorServiceContract;
  exportService: ExportServiceContract;
  postgresService: PostgresServiceContract;
}