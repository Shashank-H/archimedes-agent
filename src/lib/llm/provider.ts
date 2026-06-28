import type { AppSettings, LlmProvider, LlmProviderConfiguration } from '../../types';
import { BaseLlmProvider, type LlmConnectionTestResult, type LlmModelOption, type LlmProviderMetadata, type LlmRuntime, type StreamLlmChatArgs } from './base';
import { ChatGptSubscriptionProvider } from './chatgptSubscription';
import { OllamaProvider } from './ollama';
import { OpenAiCompatibleProvider } from './openai';

export { BaseLlmProvider } from './base';
export type { LlmConnectionTestResult, LlmModelOption, LlmProviderMetadata, LlmRuntime, StreamLlmChatArgs } from './base';

type ProviderConstructor = new () => BaseLlmProvider;

/**
 * Class-based factory for app-facing LLM runtimes.
 *
 * Today every runtime is a direct BaseLlmProvider subclass. Future agent SDK
 * runtimes (LangGraph, etc.) should implement LlmRuntime and be registered here
 * so UI components continue to call this factory without knowing the backend
 * shape.
 */
export class LlmProviderFactory {
  private readonly providerConstructors: Record<LlmProvider, ProviderConstructor> = {
    ollama: OllamaProvider,
    'openai-compatible': OpenAiCompatibleProvider,
    'chatgpt-subscription': ChatGptSubscriptionProvider,
  };

  private readonly runtimes: Record<LlmProvider, LlmRuntime> = {
    ollama: new OllamaProvider(),
    'openai-compatible': new OpenAiCompatibleProvider(),
    'chatgpt-subscription': new ChatGptSubscriptionProvider(),
  };

  createRuntime(settings: Pick<AppSettings, 'provider'>): LlmRuntime {
    return this.runtimes[settings.provider] ?? this.runtimes.ollama;
  }

  getMetadata(provider: LlmProvider): LlmProviderMetadata {
    return this.createRuntime({ provider }).metadata;
  }

  getProviderOptions(): LlmProviderMetadata[] {
    return (Object.keys(this.providerConstructors) as LlmProvider[]).map((provider) => this.getMetadata(provider));
  }

  getProviderName(provider: LlmProvider) {
    return this.createRuntime({ provider }).name;
  }

  getProviderStatus(settings: AppSettings) {
    return `${this.createRuntime(settings).name} · ${settings.model}`;
  }

  createDefaultConfiguration(provider: LlmProvider): LlmProviderConfiguration {
    const metadata = this.getMetadata(provider);
    return {
      endpoint: metadata.defaultEndpoint,
      model: metadata.defaultModel,
      apiKey: '',
      chatGptSubscriptionCredentials: provider === 'chatgpt-subscription' ? null : undefined,
    };
  }

  createDefaultConfigurations(): Record<LlmProvider, LlmProviderConfiguration> {
    return (Object.keys(this.providerConstructors) as LlmProvider[]).reduce(
      (configs, provider) => ({
        ...configs,
        [provider]: this.createDefaultConfiguration(provider),
      }),
      {} as Record<LlmProvider, LlmProviderConfiguration>,
    );
  }

  captureActiveConfiguration(settings: AppSettings): LlmProviderConfiguration {
    return {
      endpoint: settings.endpoint,
      model: settings.model,
      apiKey: settings.apiKey,
      chatGptSubscriptionCredentials: settings.providerConfigurations[settings.provider]?.chatGptSubscriptionCredentials,
    };
  }

  withActiveConfiguration(settings: AppSettings): AppSettings {
    return {
      ...settings,
      providerConfigurations: {
        ...settings.providerConfigurations,
        [settings.provider]: this.captureActiveConfiguration(settings),
      },
    };
  }

  applyProviderConfiguration(settings: AppSettings, provider: LlmProvider): AppSettings {
    const providerConfigurations = {
      ...settings.providerConfigurations,
      [settings.provider]: this.captureActiveConfiguration(settings),
    };
    const configuration = providerConfigurations[provider] ?? this.createDefaultConfiguration(provider);

    return {
      ...settings,
      provider,
      providerConfigurations,
      endpoint: configuration.endpoint,
      model: configuration.model,
      apiKey: configuration.apiKey,
    };
  }

  streamChat(args: StreamLlmChatArgs) {
    return this.createRuntime(args.settings).streamChat(args);
  }

  testConnection(settings: AppSettings): Promise<LlmConnectionTestResult> {
    return this.createRuntime(settings).testConnection(settings);
  }

  listModels(settings: AppSettings): Promise<LlmModelOption[]> {
    return this.createRuntime(settings).listModels(settings);
  }
}

export const llmProviderFactory = new LlmProviderFactory();
