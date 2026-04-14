interface Ai3dApi {
  [key: string]: unknown;
}

interface Ai3dBridge {
  api?: Ai3dApi | null;
}

declare global {
  interface Window {
    ai3d?: Ai3dBridge;
  }
}

export function createIpcClient(): Ai3dApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.ai3d?.api ?? null;
}