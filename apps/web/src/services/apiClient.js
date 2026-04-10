import { createHttpClient } from './httpClient.js';
import { createIpcClient } from './ipcClient.js';

export function createApiClient() {
  return createIpcClient() ?? createHttpClient();
}
