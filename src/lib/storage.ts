import { DEFAULT_SETTINGS, type AppSettings, type ChatMessage, type DiagramSnapshot } from '../types';
import { llmProviderFactory } from './llm/provider';

const SETTINGS_KEY = 'archimedes-agent.settings.v1';
const SCENE_KEY = 'archimedes-agent.scene.v1';
const CHAT_KEY = 'archimedes-agent.chat.v1';
const SIDEBAR_WIDTH_KEY = 'archimedes-agent.sidebarWidth.v1';

export class AppStorage {
  private getBrowserTheme(): AppSettings['theme'] {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return DEFAULT_SETTINGS.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
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
    localStorage.setItem(key, JSON.stringify(value));
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
      includeHistoryInProactiveReviews: Boolean(settings.includeHistoryInProactiveReviews),
      theme: settings.theme || browserTheme,
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
      temperature,
      thinkingLevel,
      theme,
      autoReview,
      includeHistoryInProactiveReviews,
      proactiveDelayMs,
      proactiveCooldownMs,
    } = settingsToSave;

    this.writeJson(SETTINGS_KEY, {
      provider,
      endpoint,
      apiKey,
      model,
      providerConfigurations,
      temperature,
      thinkingLevel,
      theme,
      autoReview,
      includeHistoryInProactiveReviews,
      proactiveDelayMs,
      proactiveCooldownMs,
    });
  }

  loadScene(): DiagramSnapshot | null {
    return this.readJson<DiagramSnapshot | null>(SCENE_KEY, null);
  }

  saveScene(snapshot: DiagramSnapshot) {
    this.writeJson(SCENE_KEY, snapshot);
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
