export function createIpcClient() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.ai3d?.api ?? null;
}
