import type { AppSettings, LlmChatMessage, LlmProvider } from '../../types';

export type StreamLlmChatArgs = {
  settings: AppSettings;
  messages: LlmChatMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
};

export type LlmConnectionTestResult = {
  provider: LlmProvider;
  providerName: string;
  supportsVision: boolean;
  visionSupportKnown: boolean;
  selectedModel?: unknown;
  responseText?: string;
};

export type LlmProviderMetadata = {
  id: LlmProvider;
  label: string;
  defaultEndpoint: string;
  defaultModel: string;
  requiresApiKey: boolean;
  usesOAuth?: boolean;
};

export type LlmModelOption = {
  value: string;
  label: string;
  supportsVision?: boolean;
  metadata?: unknown;
};

/**
 * App-facing runtime contract. Direct model providers implement this via
 * BaseLlmProvider today; future agent SDK integrations (for example LangGraph)
 * can implement the same methods without changing UI call sites.
 */
export interface LlmRuntime {
  readonly id: LlmProvider;
  readonly name: string;
  readonly metadata: LlmProviderMetadata;
  streamChat(args: StreamLlmChatArgs): Promise<void>;
  testConnection(settings: AppSettings): Promise<LlmConnectionTestResult>;
  listModels(settings: AppSettings): Promise<LlmModelOption[]>;
}

/**
 * Base class for direct LLM providers.
 *
 * To add another direct provider:
 * 1. Create a class that extends BaseLlmProvider.
 * 2. Implement streamChat() and testConnection().
 * 3. Map shared settings such as thinkingLevel into provider-specific API fields inside the class.
 * 4. Export provider metadata/defaults from the class.
 * 5. Register the class in provider.ts.
 */
export abstract class BaseLlmProvider implements LlmRuntime {
  abstract readonly id: LlmProvider;
  abstract readonly name: string;
  abstract readonly metadata: LlmProviderMetadata;

  abstract streamChat(args: StreamLlmChatArgs): Promise<void>;
  abstract testConnection(settings: AppSettings): Promise<LlmConnectionTestResult>;
  abstract listModels(settings: AppSettings): Promise<LlmModelOption[]>;
}
