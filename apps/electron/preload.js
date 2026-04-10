import { contextBridge, ipcRenderer } from 'electron';

async function request(path, options = {}) {
  const response = await ipcRenderer.invoke('api:request', {
    path,
    method: options.method ?? 'GET',
    body: options.body
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (response.body && !response.isBinary) {
      try {
        message = JSON.parse(response.body).message ?? message;
      } catch {
        // Ignore parse errors and preserve the fallback message.
      }
    }

    throw new Error(message);
  }

  if (options.raw) {
    const blob = response.isBinary
      ? new Blob([decodeBase64(response.body)], {
          type: response.headers['content-type'] ?? 'application/octet-stream'
        })
      : new Blob([response.body], {
          type: response.headers['content-type'] ?? 'text/plain'
        });

    return {
      blob: async () => blob,
      headers: response.headers
    };
  }

  return response.body ? JSON.parse(response.body) : {};
}

const api = {
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
  async generateDsl({ prompt, currentDsl }) {
    const payload = await request('/ai/generate-dsl', {
      method: 'POST',
      body: { prompt, currentDsl }
    });
    return payload.dsl;
  },
  downloadProjectZip(projectId) {
    return request(`/exports/${projectId}/zip`, { raw: true });
  },
  getProviders() {
    return request('/ai/providers');
  }
};

contextBridge.exposeInMainWorld('ai3d', {
  mode: 'ipc',
  api
});

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
