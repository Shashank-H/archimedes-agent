import { DEFAULT_SETTINGS, type AppSettings, type ChatMessage, type DiagramSnapshot } from '../types';
import { llmProviderFactory } from './llm/provider';
import { normalizeReviewDelayMs, normalizeReviewTimeoutMs } from './reviewTiming';

const SETTINGS_KEY = 'archimedes-agent.settings.v1';
const SCENE_KEY = 'archimedes-agent.scene.v1';
const LOCAL_DRAFTS_KEY = 'archimedes-agent.localDrafts.v1';
const CHAT_KEY = 'archimedes-agent.chat.v1';
const WORKSPACE_ROOT_KEY = 'archimedes-agent.workspaceRoot.v1';

export type LocalDraftRecord = {
  id: string;
  title: string;
  path: string;
  snapshot: DiagramSnapshot | null;
  updatedAt: number;
};

export type StoredWorkspaceRoot = {
  providerKind: 'native' | 'browser';
  path: string;
};
const SIDEBAR_WIDTH_KEY = 'archimedes-agent.sidebarWidth.v1';
const WINDOW_SCOPED_KEYS = new Set([SCENE_KEY, LOCAL_DRAFTS_KEY, CHAT_KEY, WORKSPACE_ROOT_KEY]);

function isIsolatedWindowStorage() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('archimedesWindow') === 'isolated';
}

export class AppStorage {
  private getBrowserTheme(): AppSettings['theme'] {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_SETTINGS.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private storageForKey(key: string): Storage {
    if (isIsolatedWindowStorage() && WINDOW_SCOPED_KEYS.has(key)) return sessionStorage;
    return localStorage;
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = this.storageForKey(key).getItem(key);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);

      // Arrays must stay arrays. Spreading an array into an object turns
      // chat history into {0: ..., 1: ...}, which breaks messages.map().
      if (Array.isArray(fallback)) {
        return (Array.isArray(parsed) ? parsed : fallback) as T;
      }

      if (fallback && typeof fallback === 'object' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...fallback, ...parsed } as T;
      }

      return parsed as T;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown) {
    this.storageForKey(key).setItem(key, JSON.stringify(value));
  }

  loadSettings(): AppSettings {
    const browserTheme = this.getBrowserTheme();
    const defaultProviderConfigurations = llmProviderFactory.createDefaultConfigurations();
    const settings = this.readJson<Partial<AppSettings>>(SETTINGS_KEY, {
      ...DEFAULT_SETTINGS,
      providerConfigurations: defaultProviderConfigurations,
      theme: browserTheme,
    });
    const provider = settings.provider ?? DEFAULT_SETTINGS.provider;
    const providerConfigurations = {
      ...defaultProviderConfigurations,
      ...settings.providerConfigurations,
    };
    const activeConfiguration = providerConfigurations[provider] ?? llmProviderFactory.createDefaultConfiguration(provider);

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      provider,
      providerConfigurations,
      endpoint: activeConfiguration.endpoint,
      model: activeConfiguration.model,
      apiKey: activeConfiguration.apiKey,
      codexAuth: activeConfiguration.codexAuth ?? settings.codexAuth,
      includeHistoryInProactiveReviews: Boolean(settings.includeHistoryInProactiveReviews),
      sendAnonymizedUsageLogs: settings.sendAnonymizedUsageLogs !== false,
      proactiveDelayMs: normalizeReviewDelayMs(settings.proactiveDelayMs ?? DEFAULT_SETTINGS.proactiveDelayMs),
      proactiveCooldownMs: normalizeReviewTimeoutMs(settings.proactiveCooldownMs ?? DEFAULT_SETTINGS.proactiveCooldownMs),
      providerConfigurationTestedKey: settings.providerConfigurationTestedKey ?? DEFAULT_SETTINGS.providerConfigurationTestedKey,
      theme: (() => {
        const t = settings.theme;
        const valid = ['light', 'dark', 'coffee', 'sepia'];
        if (t && valid.includes(t)) return t;
        return browserTheme;
      })(),
    };
  }

  saveSettings(settings: AppSettings) {
    const settingsToSave = llmProviderFactory.withActiveConfiguration(settings);
    const {
      provider,
      endpoint,
      apiKey,
      model,
      providerConfigurations,
      codexAuth,
      temperature,
      thinkingLevel,
      theme,
      autoReview,
      includeHistoryInProactiveReviews,
      sendAnonymizedUsageLogs,
      proactiveDelayMs,
      proactiveCooldownMs,
      providerConfigurationTestedKey,
    } = settingsToSave;

    this.writeJson(SETTINGS_KEY, {
      provider,
      endpoint,
      apiKey,
      model,
      providerConfigurations,
      codexAuth,
      temperature,
      thinkingLevel,
      theme,
      autoReview,
      includeHistoryInProactiveReviews,
      sendAnonymizedUsageLogs,
      proactiveDelayMs,
      proactiveCooldownMs,
      providerConfigurationTestedKey,
    });
  }

  loadScene(): DiagramSnapshot | null {
    return this.readJson<DiagramSnapshot | null>(SCENE_KEY, null);
  }

  saveScene(snapshot: DiagramSnapshot) {
    this.writeJson(SCENE_KEY, snapshot);
  }

  loadLocalDrafts(): LocalDraftRecord[] {
    const drafts = this.readJson<LocalDraftRecord[]>(LOCAL_DRAFTS_KEY, []);
    return drafts
      .filter((draft) => draft.id && draft.title && draft.path)
      .map((draft) => {
        const legacyMatch = /^Local draft(?: (\d+))?$/.exec(draft.title);
        if (!legacyMatch) return draft;

        const index = Number(legacyMatch[1] ?? 1);
        return {
          ...draft,
          title: index <= 1 ? 'Untitled' : `Untitled ${index}`,
        };
      });
  }

  loadLocalDraft(id: string): LocalDraftRecord | null {
    return this.loadLocalDrafts().find((draft) => draft.id === id) ?? null;
  }

  saveLocalDraft(draft: LocalDraftRecord) {
    const drafts = this.loadLocalDrafts();
    const nextDraft = { ...draft, updatedAt: Date.now() };
    const nextDrafts = drafts.some((candidate) => candidate.id === draft.id)
      ? drafts.map((candidate) => (candidate.id === draft.id ? nextDraft : candidate))
      : [...drafts, nextDraft];
    this.writeJson(LOCAL_DRAFTS_KEY, nextDrafts);
  }

  deleteLocalDraft(id: string) {
    this.writeJson(LOCAL_DRAFTS_KEY, this.loadLocalDrafts().filter((draft) => draft.id !== id));
  }

  loadWorkspaceRoot(): StoredWorkspaceRoot | null {
    const root = this.readJson<StoredWorkspaceRoot | null>(WORKSPACE_ROOT_KEY, null);
    if (!root || (root.providerKind !== 'native' && root.providerKind !== 'browser') || !root.path) return null;
    return root;
  }

  saveWorkspaceRoot(root: StoredWorkspaceRoot) {
    this.writeJson(WORKSPACE_ROOT_KEY, root);
  }

  deleteWorkspaceRoot() {
    this.storageForKey(WORKSPACE_ROOT_KEY).removeItem(WORKSPACE_ROOT_KEY);
  }

  loadChat(): ChatMessage[] {
    return this.readJson<ChatMessage[]>(CHAT_KEY, []);
  }

  saveChat(messages: ChatMessage[]) {
    this.writeJson(CHAT_KEY, messages);
  }

  loadSidebarWidth(defaultWidth: number): number {
    if (typeof localStorage === 'undefined') return defaultWidth;
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : defaultWidth;
  }

  saveSidebarWidth(width: number) {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }
}

export const appStorage = new AppStorage();
