let installed = false;

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * In the Tauri webview, replace global fetch with plugin-http so outbound API calls
 * (Codex, Ollama, custom OpenAI bases, etc.) are not blocked by browser CORS.
 */
export async function installTauriFetchIfNeeded(): Promise<void> {
  if (!isTauriRuntime() || installed) return;
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  globalThis.fetch = tauriFetch as typeof fetch;
  installed = true;
}