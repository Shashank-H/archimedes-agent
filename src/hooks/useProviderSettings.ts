import { useMemo } from 'react';
import { llmProviderFactory } from '../lib/llm/provider';
import type { AppSettings, LlmProvider } from '../types';

export function useProviderSettings(settings: AppSettings, onSettingsChange: (settings: AppSettings) => void) {
  const providerOptions = useMemo(() => llmProviderFactory.getProviderOptions(), []);
  const providerMetadata = useMemo(() => llmProviderFactory.getMetadata(settings.provider), [settings.provider]);

  const updateProvider = (provider: LlmProvider) => {
    if (provider === settings.provider) return;
    onSettingsChange(llmProviderFactory.applyProviderConfiguration(settings, provider));
  };

  return {
    providerOptions,
    providerMetadata,
    endpointPlaceholder: providerMetadata.defaultEndpoint,
    modelPlaceholder: providerMetadata.defaultModel,
    testConnectionLabel: settings.provider === 'ollama' ? 'Test Ollama' : 'Test provider',
    privacyNote:
      settings.provider === 'ollama'
        ? 'Local-only: prompts, images, chats, and diagrams are sent only to the configured Ollama endpoint.'
        : 'OpenAI-compatible mode sends prompts, diagram images, and metadata to the configured endpoint. Use a vision-capable model.',
    updateProvider,
  };
}
