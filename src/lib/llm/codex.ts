import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { AppSettings, LlmChatMessage, OpenAiCodexAuth } from '../../types';
import { BaseLlmProvider, type LlmModelOption, type StreamLlmChatArgs } from './base';

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const CODEX_AUTH_ISSUER = 'https://auth.openai.com';
const CODEX_OAUTH_TOKEN_URL = `${CODEX_AUTH_ISSUER}/oauth/token`;
const CODEX_DEVICE_USER_CODE_URL = `${CODEX_AUTH_ISSUER}/api/accounts/deviceauth/usercode`;
const CODEX_DEVICE_TOKEN_URL = `${CODEX_AUTH_ISSUER}/api/accounts/deviceauth/token`;
const CODEX_DEVICE_REDIRECT_URI = `${CODEX_AUTH_ISSUER}/deviceauth/callback`;
const CODEX_ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000;
const CODEX_DEFAULT_MODELS = ['gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.3-codex-spark'];

export type CodexDeviceAuthStart = {
  userCode: string;
  deviceAuthId: string;
  verificationUrl: string;
  intervalSeconds: number;
  expiresInSeconds: number;
};

type CodexTokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type CodexDeviceAuthUserCodeResponse = {
  user_code?: string;
  device_auth_id?: string;
  verification_url?: string;
  interval?: number | string;
  expires_in?: number | string;
};

type CodexDeviceAuthPollResponse = {
  authorization_code?: string;
  code_verifier?: string;
};

type CodexHttpResponse = {
  status: number;
  body: unknown;
};

type CodexModelEntry = {
  slug?: string;
  visibility?: string;
  priority?: number;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function requireTauriRuntime() {
  if (!isTauriRuntime()) {
    throw new Error('OpenAI Codex sign-in is available in the desktop app because ChatGPT OAuth requires the Tauri HTTP plugin.');
  }
}

function normalizeBaseUrl(endpoint: string) {
  return (endpoint || CODEX_BASE_URL).replace(/\/+$/, '');
}

function jsonNumber(value: number | string | undefined, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

async function codexFetch(input: string, init: RequestInit): Promise<Response> {
  requireTauriRuntime();
  return tauriFetch(input, init) as Promise<Response>;
}

async function parseJsonOrText(response: Response): Promise<CodexHttpResponse> {
  const status = response.status;
  const text = await response.text();
  if (!text.trim()) return { status, body: null };
  try {
    return { status, body: JSON.parse(text) };
  } catch {
    return { status, body: { message: text } };
  }
}

function assertOk(response: CodexHttpResponse, operation: string) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${operation} failed with HTTP ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

function toCodexAuth(tokens: CodexTokenResponse): OpenAiCodexAuth {
  const accessToken = tokens.accessToken || tokens.access_token;
  const refreshToken = tokens.refreshToken || tokens.refresh_token;
  if (!accessToken) throw new Error('OpenAI token response did not include an access token.');
  if (!refreshToken) throw new Error('OpenAI token response did not include a refresh token.');
  const expiresInMs = Number(tokens.expiresIn ?? tokens.expires_in ?? 3600) * 1000;
  return {
    accessToken,
    refreshToken,
    lastRefreshAt: Date.now(),
    expiresAt: Date.now() + expiresInMs,
  };
}

function withCodexAuth(settings: AppSettings, codexAuth: OpenAiCodexAuth): AppSettings {
  return {
    ...settings,
    codexAuth,
    apiKey: '',
    providerConfigurations: {
      ...settings.providerConfigurations,
      'openai-codex': {
        ...(settings.providerConfigurations['openai-codex'] ?? { endpoint: CODEX_BASE_URL, model: CODEX_DEFAULT_MODELS[0], apiKey: '' }),
        endpoint: settings.endpoint,
        model: settings.model,
        apiKey: '',
        codexAuth,
      },
    },
  };
}

function shouldRefresh(auth: OpenAiCodexAuth) {
  if (!auth.accessToken) return true;
  if (!auth.expiresAt) return false;
  return auth.expiresAt - Date.now() <= CODEX_ACCESS_TOKEN_REFRESH_SKEW_MS;
}

function mapCodexMessages(messages: LlmChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: [
      { type: 'input_text', text: message.content },
      ...(message.images ?? []).map((image) => ({
        type: 'input_image',
        image_url: `data:${image.mimeType};base64,${image.base64}`,
      })),
    ],
  }));
}

function extractSseResponseText(text: string): string {
  const deltas: string[] = [];
  const completedText: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const event = JSON.parse(payload) as Record<string, unknown>;
      if (typeof event.delta === 'string') deltas.push(event.delta);
      if (typeof event.text === 'string' && String(event.type ?? '').includes('delta')) deltas.push(event.text);
      if (typeof event.output_text === 'string') completedText.push(event.output_text);
      const item = event.item;
      if (item && typeof item === 'object') {
        const content = (item as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part && typeof part === 'object' && typeof (part as Record<string, unknown>).text === 'string') {
              completedText.push((part as Record<string, unknown>).text as string);
            }
          }
        }
      }
    } catch {
      // Ignore non-JSON stream frames.
    }
  }

  return (deltas.length ? deltas : completedText).join('').trim();
}

function extractResponseText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const data = body as Record<string, unknown>;
  if (typeof data.message === 'string') return extractSseResponseText(data.message);
  if (typeof data.output_text === 'string') return data.output_text.trim();

  const output = data.output;
  if (!Array.isArray(output)) return '';

  return output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const record = part as Record<string, unknown>;
      if (typeof record.text === 'string') return record.text;
      if (typeof record.output_text === 'string') return record.output_text;
      return '';
    })
    .join('')
    .trim();
}

function extractCodexAccountId(accessToken: string) {
  try {
    const [, payload] = accessToken.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded?.['https://api.openai.com/auth']?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

function extractError(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    const error = data.error;
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === 'string') return message;
    }
    const message = data.message;
    if (typeof message === 'string') return message;
  }
  return `HTTP ${status}`;
}

function toModelOptions(body: unknown): LlmModelOption[] {
  if (!body || typeof body !== 'object') return CODEX_DEFAULT_MODELS.map((model) => ({ value: model, label: model }));
  const models = (body as { models?: CodexModelEntry[] }).models ?? [];
  const options: LlmModelOption[] = models
    .filter((model) => model.slug && !['hide', 'hidden'].includes(String(model.visibility ?? '').toLowerCase()))
    .sort((left, right) => (left.priority ?? 10_000) - (right.priority ?? 10_000) || String(left.slug).localeCompare(String(right.slug)))
    .map((model) => ({ value: model.slug as string, label: model.slug as string, metadata: model }));

  for (const model of CODEX_DEFAULT_MODELS) {
    if (!options.some((option) => option.value === model)) options.push({ value: model, label: model });
  }
  return options;
}

export class OpenAiCodexAuthService {
  async startDeviceAuth(): Promise<CodexDeviceAuthStart> {
    const response = await codexFetch(CODEX_DEVICE_USER_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: CODEX_OAUTH_CLIENT_ID }),
    });
    const parsed = await parseJsonOrText(response);
    assertOk(parsed, 'OpenAI device code request');
    const payload = parsed.body as CodexDeviceAuthUserCodeResponse;
    if (!payload?.user_code || !payload.device_auth_id) {
      throw new Error(`OpenAI device code response was missing required fields: ${JSON.stringify(parsed.body)}`);
    }

    return {
      userCode: payload.user_code,
      deviceAuthId: payload.device_auth_id,
      verificationUrl: payload.verification_url || `${CODEX_AUTH_ISSUER}/codex/device`,
      intervalSeconds: Math.max(3, jsonNumber(payload.interval, 5)),
      expiresInSeconds: jsonNumber(payload.expires_in, 900),
    };
  }

  async pollDeviceAuth(deviceAuthId: string, userCode: string): Promise<OpenAiCodexAuth | null> {
    const response = await codexFetch(CODEX_DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }),
    });
    if (response.status === 403 || response.status === 404) return null;

    const parsed = await parseJsonOrText(response);
    assertOk(parsed, 'OpenAI device authorization polling');
    const payload = parsed.body as CodexDeviceAuthPollResponse;
    if (!payload?.authorization_code || !payload.code_verifier) {
      throw new Error(`OpenAI device authorization response was missing required fields: ${JSON.stringify(parsed.body)}`);
    }

    const tokenResponse = await codexFetch(CODEX_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: payload.authorization_code,
        redirect_uri: CODEX_DEVICE_REDIRECT_URI,
        client_id: CODEX_OAUTH_CLIENT_ID,
        code_verifier: payload.code_verifier,
      }).toString(),
    });
    const token = await parseJsonOrText(tokenResponse);
    assertOk(token, 'OpenAI token exchange');
    return toCodexAuth(token.body as CodexTokenResponse);
  }

  async refresh(refreshToken: string): Promise<OpenAiCodexAuth> {
    if (!refreshToken.trim()) throw new Error('OpenAI Codex session is missing a refresh token. Sign in again.');
    const response = await codexFetch(CODEX_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'archimedes-agent/0.1.0',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CODEX_OAUTH_CLIENT_ID,
      }).toString(),
    });
    const parsed = await parseJsonOrText(response);
    assertOk(parsed, 'OpenAI Codex token refresh');
    const tokens = parsed.body as CodexTokenResponse;
    return toCodexAuth({ ...tokens, refreshToken: tokens.refreshToken || refreshToken });
  }
}

export const openAiCodexAuthService = new OpenAiCodexAuthService();

export class OpenAiCodexProvider extends BaseLlmProvider {
  readonly id = 'openai-codex' as const;
  readonly name = 'OpenAI Codex';
  readonly metadata = {
    id: this.id,
    label: this.name,
    defaultEndpoint: CODEX_BASE_URL,
    defaultModel: CODEX_DEFAULT_MODELS[0],
    requiresApiKey: false,
  } as const;

  private async getAuth(settings: AppSettings, onSettingsChange?: (settings: AppSettings) => void) {
    let auth = settings.codexAuth ?? settings.providerConfigurations['openai-codex']?.codexAuth;
    if (!auth?.accessToken) throw new Error('Sign in with ChatGPT before using OpenAI Codex.');
    if (shouldRefresh(auth)) {
      if (!auth.refreshToken) throw new Error('OpenAI Codex session is missing a refresh token. Sign in again.');
      auth = await openAiCodexAuthService.refresh(auth.refreshToken);
      onSettingsChange?.(withCodexAuth(settings, auth));
    }
    return auth;
  }

  private async codexRequest(settings: AppSettings, path: string, body: unknown, onSettingsChange?: (settings: AppSettings) => void) {
    const auth = await this.getAuth(settings, onSettingsChange);
    const accountId = extractCodexAccountId(auth.accessToken);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
      'OpenAI-Beta': 'responses=experimental',
      originator: 'archimedes',
      'User-Agent': 'archimedes-agent/0.1.0',
    };
    if (accountId) headers['chatgpt-account-id'] = accountId;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const rawResponse = await codexFetch(`${normalizeBaseUrl(settings.endpoint)}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await parseJsonOrText(rawResponse);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(extractError(response.body, response.status));
    }
    return response.body;
  }

  async streamChat({ settings, messages, onToken, onSettingsChange }: StreamLlmChatArgs) {
    const body = await this.codexRequest(settings, '/responses', {
      model: settings.model,
      store: false,
      stream: true,
      input: mapCodexMessages(messages),
    }, onSettingsChange);
    const text = extractResponseText(body);
    if (!text) throw new Error('OpenAI Codex returned an empty response.');
    onToken(text);
  }

  async listModels(settings: AppSettings): Promise<LlmModelOption[]> {
    try {
      const body = await this.codexRequest(settings, '/models?client_version=1.0.0', undefined);
      return toModelOptions(body);
    } catch {
      return CODEX_DEFAULT_MODELS.map((model) => ({ value: model, label: model }));
    }
  }

  async testConnection(settings: AppSettings, onSettingsChange?: (settings: AppSettings) => void) {
    const body = await this.codexRequest(settings, '/responses', {
      model: settings.model,
      store: false,
      stream: true,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: 'Respond in one very brief sentence.' }] },
        { role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
      ],
    }, onSettingsChange);
    const responseText = extractResponseText(body);
    if (!responseText) throw new Error('OpenAI Codex test returned an empty response.');
    return {
      provider: this.id,
      providerName: this.name,
      supportsVision: true,
      visionSupportKnown: false,
      responseText,
    };
  }
}

export function applyCodexAuth(settings: AppSettings, codexAuth: OpenAiCodexAuth) {
  return withCodexAuth(settings, codexAuth);
}
