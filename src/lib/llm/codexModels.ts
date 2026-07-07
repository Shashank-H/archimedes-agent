/**
 * Codex model discovery — aligned with Hermes `hermes_cli/codex_models.py`.
 * Live: GET https://chatgpt.com/backend-api/codex/models?client_version=1.0.0
 * Auth: Bearer OAuth access token (same device-code flow as Codex CLI).
 */

import { CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT, type AppSettings } from '../../types';

const CODEX_MODELS_URL = `${CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT}/models?client_version=1.0.0`;

/** Curated fallback when live discovery is unavailable (offline / CORS / no sign-in). */
export const DEFAULT_CODEX_MODELS = [
  'gpt-5.5',
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
] as const;

const FORWARD_COMPAT_TEMPLATE_MODELS: Array<[string, string[]]> = [
  ['gpt-5.5', ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex']],
  ['gpt-5.4-mini', ['gpt-5.3-codex']],
  ['gpt-5.4', ['gpt-5.3-codex']],
  ['gpt-5.3-codex-spark', ['gpt-5.3-codex']],
];

function addForwardCompatModels(modelIds: string[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of modelIds) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const [synthetic, templates] of FORWARD_COMPAT_TEMPLATE_MODELS) {
    if (seen.has(synthetic)) continue;
    if (templates.some((t) => seen.has(t))) {
      ordered.push(synthetic);
      seen.add(synthetic);
    }
  }
  return ordered;
}

type CodexModelEntry = {
  slug?: string;
  visibility?: string;
  priority?: number;
};

function parseCodexModelEntries(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const sortable: Array<[number, string]> = [];
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as CodexModelEntry;
    const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    if (!slug) continue;
    const visibility = typeof entry.visibility === 'string' ? entry.visibility.trim().toLowerCase() : '';
    if (visibility === 'hide' || visibility === 'hidden') continue;
    const priority = entry.priority;
    const rank = typeof priority === 'number' && Number.isFinite(priority) ? priority : 10_000;
    sortable.push([rank, slug]);
  }
  sortable.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1].localeCompare(b[1])));
  return addForwardCompatModels(sortable.map(([, slug]) => slug));
}

export async function fetchCodexModelIds(accessToken: string): Promise<string[]> {
  const response = await fetch(CODEX_MODELS_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { models?: unknown };
  return parseCodexModelEntries(data?.models);
}

export function fallbackCodexModelIds(): string[] {
  return addForwardCompatModels([...DEFAULT_CODEX_MODELS]);
}

export function codexModelSupportsVision(modelId: string): boolean {
  if (/spark/i.test(modelId)) return false;
  return /^(gpt-5|gpt-4|o\d|o[134]-)/i.test(modelId);
}

export async function resolveCodexModelIds(settings: AppSettings): Promise<string[]> {
  const credentials = settings.providerConfigurations['chatgpt-subscription']?.chatGptSubscriptionCredentials;
  if (credentials?.access) {
    const live = await fetchCodexModelIds(credentials.access);
    if (live.length > 0) return live;
  }
  return fallbackCodexModelIds();
}