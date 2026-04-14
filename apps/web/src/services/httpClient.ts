const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  dsl?: unknown;
  [key: string]: unknown;
}

export interface VersionRecord {
  id: string;
  versionNumber?: number;
  source?: string;
  [key: string]: unknown;
}

export interface AssetRecord {
  id: string;
  previewColor?: string;
  [key: string]: unknown;
}

export interface SessionRecord {
  id: string;
  projectId: string;
  mode: string;
  status?: string;
  [key: string]: unknown;
}

export interface MessageRecord {
  id: string;
  role: string;
  content?: { text?: string } | Record<string, unknown>;
  createdAt?: string;
  [key: string]: unknown;
}

export interface QuestionRecord {
  id: string;
  prompt: string;
  options?: string[];
  status?: string;
  [key: string]: unknown;
}

export interface DecisionRecord {
  id: string;
  selectedOption: string;
  rationale?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface SessionHistoryRecord {
  session?: SessionRecord;
  messages: MessageRecord[];
  questions: QuestionRecord[];
  decisions: DecisionRecord[];
  hasMoreMessages?: boolean;
  totalMessages?: number;
}

interface RequestOptions {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
  raw?: boolean;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface ApiClient {
  listProjects: () => Promise<ProjectRecord[]>;
  getProject: (projectId: string) => Promise<ProjectRecord>;
  createProject: (data: Record<string, unknown>) => Promise<ProjectRecord>;
  saveDsl: (projectId: string, dsl: unknown) => Promise<ProjectRecord>;
  patchDsl: (projectId: string, operations: unknown[]) => Promise<unknown>;
  listVersions: (projectId: string) => Promise<VersionRecord[]>;
  searchAssets: (q?: string, tags?: string[]) => Promise<AssetRecord[]>;
  createSession: (projectId: string, mode: string) => Promise<SessionRecord>;
  getSession: (projectId: string, sessionId: string) => Promise<SessionRecord>;
  listSessionHistory: (
    projectId: string,
    sessionId: string,
    options?: PaginationOptions
  ) => Promise<SessionHistoryRecord>;
  sendSessionMessage: (projectId: string, sessionId: string, message: string) => Promise<{ status: string; [key: string]: unknown }>;
  resolveQuestion: (
    projectId: string,
    sessionId: string,
    questionId: string,
    selectedOption: string,
    rationale?: string
  ) => Promise<{ status: string; [key: string]: unknown }>;
  createEventStream: (projectId: string, sessionId: string) => EventSource;
  downloadProjectZip: (projectId: string) => Promise<Response>;
}

export function createHttpClient(baseUrl = DEFAULT_BASE_URL): ApiClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers ?? {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({} as { message?: string }));
      throw new Error(errorPayload.message ?? `Request failed with status ${response.status}`);
    }

    if (options.raw) {
      return response as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    async listProjects() {
      const payload = await request<{ items: ProjectRecord[] }>('/projects');
      return payload.items;
    },
    getProject(projectId) {
      return request<ProjectRecord>(`/projects/${projectId}`);
    },
    createProject(data) {
      return request<ProjectRecord>('/projects', {
        method: 'POST',
        body: data
      });
    },
    saveDsl(projectId, dsl) {
      return request<ProjectRecord>(`/projects/${projectId}/dsl`, {
        method: 'PUT',
        body: dsl
      });
    },
    patchDsl(projectId, operations) {
      return request(`/projects/${projectId}/dsl`, {
        method: 'PATCH',
        body: { operations }
      });
    },
    async listVersions(projectId) {
      const payload = await request<{ items: VersionRecord[] }>(`/projects/${projectId}/versions`);
      return payload.items;
    },
    async searchAssets(q = '', tags: string[] = []) {
      const params = new URLSearchParams();
      if (q) {
        params.set('q', q);
      }
      if (tags.length > 0) {
        params.set('tags', tags.join(','));
      }

      const payload = await request<{ items: AssetRecord[] }>(`/assets/search?${params.toString()}`);
      return payload.items;
    },
    createSession(projectId, mode) {
      return request<SessionRecord>(`/projects/${projectId}/ai/sessions`, {
        method: 'POST',
        body: { mode }
      });
    },
    getSession(projectId, sessionId) {
      return request<SessionRecord>(`/projects/${projectId}/ai/sessions/${sessionId}`);
    },
    listSessionHistory(projectId, sessionId, options = {}) {
      const params = new URLSearchParams();
      if (Number.isFinite(options.limit) && (options.limit ?? 0) > 0) {
        params.set('limit', String(options.limit));
      }
      if (Number.isFinite(options.offset) && (options.offset ?? 0) >= 0) {
        params.set('offset', String(options.offset));
      }

      const query = params.toString();
      const path = query
        ? `/projects/${projectId}/ai/sessions/${sessionId}/history?${query}`
        : `/projects/${projectId}/ai/sessions/${sessionId}/history`;

      return request<SessionHistoryRecord>(path);
    },
    sendSessionMessage(projectId, sessionId, message) {
      return request<{ status: string; [key: string]: unknown }>(`/projects/${projectId}/ai/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { message }
      });
    },
    resolveQuestion(projectId, sessionId, questionId, selectedOption, rationale = '') {
      return request<{ status: string; [key: string]: unknown }>(`/projects/${projectId}/ai/sessions/${sessionId}/questions/${questionId}/decision`, {
        method: 'POST',
        body: { selectedOption, rationale }
      });
    },
    createEventStream(projectId, sessionId) {
      return new EventSource(`${baseUrl}/projects/${projectId}/ai/sessions/${sessionId}/events`);
    },
    downloadProjectZip(projectId) {
      return request<Response>(`/exports/${projectId}/zip`, { raw: true });
    }
  };
}