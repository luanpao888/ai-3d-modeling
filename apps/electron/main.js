import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:5173';
const apiBaseUrl = process.env.ELECTRON_API_URL || 'http://127.0.0.1:3000';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.loadURL(rendererUrl);
}

app.whenReady().then(() => {
  ipcMain.handle('api:request', async (_event, payload) => {
    const response = await fetch(`${apiBaseUrl}${payload.path}`, {
      method: payload.method ?? 'GET',
      headers: {
        ...(payload.body ? { 'content-type': 'application/json' } : {})
      },
      body: payload.body ? JSON.stringify(payload.body) : undefined
    });

    const contentType = response.headers.get('content-type') ?? 'application/json';
    const isBinary = contentType.includes('application/zip') || contentType.includes('application/octet-stream');

    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      isBinary,
      body: isBinary
        ? Buffer.from(await response.arrayBuffer()).toString('base64')
        : await response.text()
    };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
