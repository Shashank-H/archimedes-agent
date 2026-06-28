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
    testConnectionLabel: providerMetadata.usesOAuth ? 'Save and test subscription' : 'Save',
    modelInfoTooltip: providerMetadata.usesOAuth
      ? 'Uses ChatGPT/Codex OAuth subscription access. Choose a vision-capable Codex/OpenAI model.'
      : 'Sends prompts, images, and diagram metadata to this model. Choose a vision-capable model.',
    updateProvider,
  };
}
