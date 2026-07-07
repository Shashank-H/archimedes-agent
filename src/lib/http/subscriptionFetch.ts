const CHATGPT_ORIGIN = 'https://chatgpt.com';
const AUTH_ORIGIN = 'https://auth.openai.com';

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

function useViteDevProxy(): boolean {
  if (typeof window === 'undefined' || isTauriRuntime()) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function rewriteForDevProxy(absoluteUrl: string): string {
  if (!useViteDevProxy()) return absoluteUrl;
  try {
    const url = new URL(absoluteUrl);
    if (url.origin === CHATGPT_ORIGIN) {
      return `/__subscription-proxy/chatgpt${url.pathname}${url.search}`;
    }
    if (url.origin === AUTH_ORIGIN) {
      return `/__subscription-proxy/auth${url.pathname}${url.search}`;
    }
  } catch {
    // keep original
  }
  return absoluteUrl;
}

/**
 * Codex subscription traffic must not use the WebView fetch to chatgpt.com / auth.openai.com (CORS).
 * - Tauri desktop: native HTTP via plugin-http
 * - Vite dev in browser: same-origin proxy paths
 */
export async function subscriptionFetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(input, init);
  }
  return globalThis.fetch(rewriteForDevProxy(input), init);
}