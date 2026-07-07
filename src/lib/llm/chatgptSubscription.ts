import { CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT, type AppSettings, type ChatGptSubscriptionCredentials, type LlmChatMessage } from '../../types';
import { subscriptionFetch } from '../http/subscriptionFetch';
import { BaseLlmProvider, type LlmModelOption, type StreamLlmChatArgs } from './base';
import { codexModelSupportsVision, resolveCodexModelIds } from './codexModels';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTH_BASE_URL = 'https://auth.openai.com';
const TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
const DEVICE_USER_CODE_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/token`;
export const OPENAI_CODEX_DEVICE_VERIFICATION_URI = `${AUTH_BASE_URL}/codex/device`;
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`;
const DEVICE_CODE_TIMEOUT_SECONDS = 15 * 60;
const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
const TOKEN_REFRESH_WINDOW_MS = 60_000;

export type OpenAiCodexDeviceCodeInfo = {
  userCode: string;
  verificationUri: string;
  intervalSeconds: number;
  expiresInSeconds: number;
};

type OAuthToken = { access: string; refresh: string; expires: number };
type DeviceAuthInfo = { deviceAuthId: string; userCode: string; intervalSeconds: number };
type DeviceTokenSuccess = { authorizationCode: string; codeVerifier: string };
type OpenAiResponsesResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type ChatGptJwtPayload = {
  [JWT_CLAIM_PATH]?: { chatgpt_account_id?: string };
  email?: string;
  name?: string;
  [key: string]: unknown;
};

function normalizeBaseUrl(endpoint: string) {
  return endpoint.replace(/\/+$/, '');
}

export function resolveSubscriptionApiBase(endpoint?: string) {
  const candidate = normalizeBaseUrl(endpoint?.trim() || CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT);
  try {
    const url = new URL(candidate);
    const path = url.pathname.replace(/\/+$/, '');
    if (url.hostname === 'api.openai.com' && path === '/v1') return CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT;
  } catch {
    // Keep non-URL custom endpoints untouched; fetch will surface invalid values.
  }
  return candidate;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function decodeJwt(token: string): ChatGptJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    return JSON.parse(decodeBase64Url(parts[1])) as ChatGptJwtPayload;
  } catch {
    return null;
  }
}

function credentialsFromToken(token: OAuthToken): ChatGptSubscriptionCredentials {
  const payload = decodeJwt(token.access);
  const accountId = payload?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
  if (!accountId) throw new Error('Failed to extract ChatGPT account ID from OpenAI Codex token.');

  return {
    access: token.access,
    refresh: token.refresh,
    expires: token.expires,
    accountId,
    email: typeof payload?.email === 'string' ? payload.email : undefined,
    name: typeof payload?.name === 'string' ? payload.name : undefined,
  };
}

async function fetchWithLoginCancellation(input: string, init: RequestInit): Promise<Response> {
  try {
    return await subscriptionFetch(input, init);
  } catch (error) {
    if (init.signal?.aborted) throw new Error('Login cancelled');
    throw error;
  }
}

async function readTokenResponse(response: Response, operation: 'exchange' | 'refresh'): Promise<OAuthToken> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI Codex token ${operation} failed (${response.status}): ${text || response.statusText}`);
  }

  const json = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
  if (!json?.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error(`OpenAI Codex token ${operation} response missing fields: ${JSON.stringify(json)}`);
  }

  return { access: json.access_token, refresh: json.refresh_token, expires: Date.now() + json.expires_in * 1000 };
}

async function exchangeAuthorizationCode(code: string, verifier: string, redirectUri = DEVICE_REDIRECT_URI, signal?: AbortSignal) {
  const response = await fetchWithLoginCancellation(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT_ID, code, code_verifier: verifier, redirect_uri: redirectUri }),
    signal,
  });
  return readTokenResponse(response, 'exchange');
}

export async function refreshOpenAICodexToken(refreshToken: string): Promise<ChatGptSubscriptionCredentials> {
  const response = await subscriptionFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }),
  });
  return credentialsFromToken(await readTokenResponse(response, 'refresh'));
}

async function startOpenAICodexDeviceAuth(signal?: AbortSignal): Promise<DeviceAuthInfo> {
  const response = await fetchWithLoginCancellation(DEVICE_USER_CODE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID }),
    signal,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`OpenAI Codex device code request failed with status ${response.status}${responseBody ? `: ${responseBody}` : ''}`);
  }

  const json = (await response.json()) as { device_auth_id?: string; user_code?: string; interval?: number | string } | null;
  const intervalSeconds = typeof json?.interval === 'string' ? Number(json.interval.trim()) : json?.interval;
  if (!json?.device_auth_id || !json.user_code || typeof intervalSeconds !== 'number' || !Number.isFinite(intervalSeconds)) {
    throw new Error(`Invalid OpenAI Codex device code response: ${JSON.stringify(json)}`);
  }

  return { deviceAuthId: json.device_auth_id, userCode: json.user_code, intervalSeconds };
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Login cancelled'));
    const timeout = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeout);
      reject(new Error('Login cancelled'));
    }, { once: true });
  });
}

async function pollOpenAICodexDeviceAuth(device: DeviceAuthInfo, signal?: AbortSignal): Promise<DeviceTokenSuccess> {
  const startedAt = Date.now();
  let intervalSeconds = Math.max(1, device.intervalSeconds);

  while (Date.now() - startedAt < DEVICE_CODE_TIMEOUT_SECONDS * 1000) {
    await wait(intervalSeconds * 1000, signal);
    const response = await fetchWithLoginCancellation(DEVICE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_auth_id: device.deviceAuthId, user_code: device.userCode }),
      signal,
    });

    if (response.ok) {
      const json = (await response.json()) as { authorization_code?: string; code_verifier?: string } | null;
      if (!json?.authorization_code || !json.code_verifier) throw new Error(`Invalid OpenAI Codex device auth token response: ${JSON.stringify(json)}`);
      return { authorizationCode: json.authorization_code, codeVerifier: json.code_verifier };
    }

    const responseBody = await response.text().catch(() => '');
    let errorCode: unknown;
    try {
      const json = JSON.parse(responseBody) as { error?: string | { code?: string } } | null;
      errorCode = typeof json?.error === 'object' ? json.error?.code : json?.error;
    } catch {
      // ignore parse errors
    }

    if (response.status === 403 || response.status === 404 || errorCode === 'deviceauth_authorization_pending') continue;
    if (errorCode === 'slow_down') {
      intervalSeconds += 5;
      continue;
    }
    throw new Error(`OpenAI Codex device auth failed with status ${response.status}${responseBody ? `: ${responseBody}` : ''}`);
  }

  throw new Error('OpenAI Codex device login expired. Start sign-in again.');
}

export async function loginOpenAICodexDeviceCode(options: {
  onDeviceCode: (info: OpenAiCodexDeviceCodeInfo) => void;
  signal?: AbortSignal;
}): Promise<ChatGptSubscriptionCredentials> {
  const device = await startOpenAICodexDeviceAuth(options.signal);
  options.onDeviceCode({
    userCode: device.userCode,
    verificationUri: OPENAI_CODEX_DEVICE_VERIFICATION_URI,
    intervalSeconds: device.intervalSeconds,
    expiresInSeconds: DEVICE_CODE_TIMEOUT_SECONDS,
  });
  const code = await pollOpenAICodexDeviceAuth(device, options.signal);
  return credentialsFromToken(await exchangeAuthorizationCode(code.authorizationCode, code.codeVerifier, DEVICE_REDIRECT_URI, options.signal));
}

function toResponsesInput(messages: LlmChatMessage[]) {
  return messages.map((message) => {
    if (!message.images?.length) return { role: message.role, content: message.content };
    return {
      role: message.role,
      content: [
        { type: 'input_text', text: message.content },
        ...message.images.map((image) => ({ type: 'input_image', image_url: `data:${image.mimeType};base64,${image.base64}` })),
      ],
    };
  });
}

async function parseOpenAiError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || body?.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function extractResponsesText(response: OpenAiResponsesResponse) {
  if (typeof response.output_text === 'string') return response.output_text.trim();
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => (part.type === 'output_text' || part.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join('')
      .trim() ?? ''
  );
}

export function subscriptionCredentials(settings: AppSettings): ChatGptSubscriptionCredentials {
  const credentials = settings.providerConfigurations['chatgpt-subscription']?.chatGptSubscriptionCredentials;
  if (!credentials?.access || !credentials.refresh || !credentials.accountId) {
    throw new Error('Sign in with ChatGPT Pro / Codex Subscription before using this provider.');
  }
  return credentials;
}

async function freshCredentials(
  settings: AppSettings,
  onRefreshed?: (credentials: ChatGptSubscriptionCredentials) => void,
): Promise<ChatGptSubscriptionCredentials> {
  const credentials = subscriptionCredentials(settings);
  if (credentials.expires > Date.now() + TOKEN_REFRESH_WINDOW_MS) return credentials;
  const refreshed = await refreshOpenAICodexToken(credentials.refresh);
  onRefreshed?.(refreshed);
  return refreshed;
}

function authHeaders(credentials: ChatGptSubscriptionCredentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credentials.access}`,
    'ChatGPT-Account-ID': credentials.accountId,
  };
}

function isReasoningModel(model: string) {
  return /^(gpt-5|o\d|o[134]-|o4-|o3-)/i.test(model);
}

function responsesReasoningConfig(settings: AppSettings) {
  if (!isReasoningModel(settings.model)) return {};
  return { reasoning: { effort: settings.thinkingLevel === 'off' ? 'minimal' : settings.thinkingLevel } };
}

function responsesRequestBody(settings: AppSettings, messages: LlmChatMessage[], stream: boolean) {
  return {
    model: settings.model,
    stream,
    ...(!isReasoningModel(settings.model) ? { temperature: settings.temperature } : {}),
    ...responsesReasoningConfig(settings),
    input: toResponsesInput(messages),
  };
}

export class ChatGptSubscriptionProvider extends BaseLlmProvider {
  readonly id = 'chatgpt-subscription' as const;
  readonly name = 'ChatGPT Pro / Codex';
  readonly metadata = {
    id: this.id,
    label: this.name,
    defaultEndpoint: CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT,
    defaultModel: 'gpt-5.4',
    requiresApiKey: false,
    usesOAuth: true,
  } as const;

  async streamChat({ settings, messages, signal, onToken, onChatGptSubscriptionCredentialsRefreshed }: StreamLlmChatArgs) {
    const credentials = await freshCredentials(settings, onChatGptSubscriptionCredentialsRefreshed);
    const baseUrl = resolveSubscriptionApiBase(settings.endpoint);
    const response = await subscriptionFetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: authHeaders(credentials),
      signal,
      body: JSON.stringify(responsesRequestBody(settings, messages, true)),
    });

    if (!response.ok) throw new Error(`ChatGPT subscription request failed: ${await parseOpenAiError(response)}`);
    if (!response.body) throw new Error('ChatGPT subscription response did not include a stream.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice('data:'.length).trim();
        if (!data) continue;
        if (data === '[DONE]') return;
        const json = JSON.parse(data) as { type?: string; delta?: string; error?: { message?: string }; response?: { error?: { message?: string } } };
        if (json.error?.message) throw new Error(json.error.message);
        if (json.response?.error?.message) throw new Error(json.response.error.message);
        if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') onToken(json.delta);
        if (json.type === 'response.completed') return;
      }
    }
  }

  async listModels(settings: AppSettings): Promise<LlmModelOption[]> {
    const ids = await resolveCodexModelIds(settings);
    return ids.map((value) => ({
      value,
      label: value,
      supportsVision: codexModelSupportsVision(value),
    }));
  }

  async testConnection(settings: AppSettings) {
    const credentials = await freshCredentials(settings, undefined);
    const baseUrl = resolveSubscriptionApiBase(settings.endpoint);
    const response = await subscriptionFetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: authHeaders(credentials),
      body: JSON.stringify(
        responsesRequestBody(
          settings,
          [
            { role: 'system', content: 'Respond in one very brief sentence.' },
            { role: 'user', content: 'hi' },
          ],
          false,
        ),
      ),
    });

    if (!response.ok) throw new Error(`ChatGPT subscription test failed: ${await parseOpenAiError(response)}`);
    const data = (await response.json()) as OpenAiResponsesResponse;
    if (data.error?.message) throw new Error(data.error.message);
    const responseText = extractResponsesText(data);
    if (!responseText) throw new Error('ChatGPT subscription test returned an empty response.');

    return {
      provider: this.id,
      providerName: this.name,
      supportsVision: true,
      visionSupportKnown: false,
      responseText,
    };
  }
}