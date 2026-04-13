const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function createHttpClient(baseUrl = DEFAULT_BASE_URL) {
  async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers ?? {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.message ?? `Request failed with status ${response.status}`);
    }

    if (options.raw) {
      return response;
    }

    return response.json();
  }

  return {
    async listProjects() {
      const payload = await request('/projects');
      return payload.items;
    },
    getProject(projectId) {
      return request(`/projects/${projectId}`);
    },
    createProject(data) {
      return request('/projects', {
        method: 'POST',
        body: data
      });
    },
    saveDsl(projectId, dsl) {
      return request(`/projects/${projectId}/dsl`, {
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
      const payload = await request(`/projects/${projectId}/versions`);
      return payload.items;
    },
    async searchAssets(q = '', tags = []) {
      const params = new URLSearchParams();
      if (q) {
        params.set('q', q);
      }
      if (tags.length > 0) {
        params.set('tags', tags.join(','));
      }

      const payload = await request(`/assets/search?${params.toString()}`);
      return payload.items;
    },
    createSession(projectId, mode) {
      return request(`/projects/${projectId}/ai/sessions`, {
        method: 'POST',
        body: { mode }
      });
    },
    getSession(projectId, sessionId) {
      return request(`/projects/${projectId}/ai/sessions/${sessionId}`);
    },
    listSessionHistory(projectId, sessionId) {
      return request(`/projects/${projectId}/ai/sessions/${sessionId}/history`);
    },
    sendSessionMessage(projectId, sessionId, message) {
      return request(`/projects/${projectId}/ai/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { message }
      });
    },
    resolveQuestion(projectId, sessionId, questionId, selectedOption, rationale = '') {
      return request(`/projects/${projectId}/ai/sessions/${sessionId}/questions/${questionId}/decision`, {
        method: 'POST',
        body: { selectedOption, rationale }
      });
    },
    createEventStream(projectId, sessionId) {
      return new EventSource(`${baseUrl}/projects/${projectId}/ai/sessions/${sessionId}/events`);
    },
    downloadProjectZip(projectId) {
      return request(`/exports/${projectId}/zip`, { raw: true });
    }
  };
}
