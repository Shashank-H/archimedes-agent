import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';
export type AppTheme = 'light' | 'dark';
export type LlmProvider = 'ollama' | 'openai-compatible' | 'chatgpt-subscription';

export type ChatGptSubscriptionCredentials = {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
  email?: string;
  name?: string;
};

export type LlmProviderConfiguration = {
  endpoint: string;
  apiKey: string;
  model: string;
  chatGptSubscriptionCredentials?: ChatGptSubscriptionCredentials | null;
};

export type LlmImage = {
  base64: string;
  mimeType: 'image/png' | 'image/webp';
};

export type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: LlmImage[];
};

export type AppSettings = {
  provider: LlmProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  providerConfigurations: Record<LlmProvider, LlmProviderConfiguration>;
  temperature: number;
  thinkingLevel: ThinkingLevel;
  theme: AppTheme;
  autoReview: boolean;
  includeHistoryInProactiveReviews: boolean;
  sendAnonymizedUsageLogs: boolean;
  proactiveDelayMs: number;
  proactiveCooldownMs: number;
  providerConfigurationTestedKey: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  kind?: 'chat' | 'manual-review' | 'proactive-review' | 'status' | 'error';
};

export type DiagramSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  updatedAt: number;
};

export type DiagramSummary = {
  elementCount: number;
  textLabels: string[];
  arrows: Array<{
    id: string;
    text?: string;
    startBoundElementId?: string | null;
    endBoundElementId?: string | null;
  }>;
  groups: Record<string, number>;
  unlabeledElementCount: number;
  obviousUnlabeledComponents: string[];
  imageGeneratedAt: number;
};

export type DiagramExport = {
  base64: string;
  mimeType: 'image/png' | 'image/webp';
  summary: DiagramSummary;
};

export type ExcalidrawApi = ExcalidrawImperativeAPI;

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  apiKey: '',
  model: 'gemma4:e4b',
  providerConfigurations: {
    ollama: {
      endpoint: 'http://localhost:11434',
      apiKey: '',
      model: 'gemma4:e4b',
    },
    'openai-compatible': {
      endpoint: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
    },
    'chatgpt-subscription': {
      endpoint: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-5-codex',
      chatGptSubscriptionCredentials: null,
    },
  },
  temperature: 0.3,
  thinkingLevel: 'low',
  theme: 'light',
  autoReview: true,
  includeHistoryInProactiveReviews: false,
  sendAnonymizedUsageLogs: true,
  proactiveDelayMs: 12_000,
  proactiveCooldownMs: 60_000,
  providerConfigurationTestedKey: '',
};
