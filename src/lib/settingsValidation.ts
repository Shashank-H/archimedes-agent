import type { AppSettings } from '../types';

export function settingsValidationKey(settings: AppSettings) {
  const credentials = settings.providerConfigurations[settings.provider]?.chatGptSubscriptionCredentials;
  return [
    settings.provider,
    settings.endpoint,
    settings.model,
    settings.apiKey,
    credentials?.accountId ?? '',
    credentials?.expires ?? '',
    settings.temperature,
    settings.thinkingLevel,
  ].join('\u001f');
}
