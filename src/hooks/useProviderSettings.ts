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
    testConnectionLabel: 'Save',
    modelInfoTooltip: settings.provider === 'openai-codex'
      ? 'Uses the ChatGPT Codex backend with your local OAuth session. Choose a Codex model available to your ChatGPT account.'
      : 'Sends prompts, images, and diagram metadata to this model. Choose a vision-capable model.',
    updateProvider,
  };
}
