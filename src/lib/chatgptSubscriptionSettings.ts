import type { AppSettings, ChatGptSubscriptionCredentials } from '../types';

export function mergeChatGptSubscriptionCredentials(
  settings: AppSettings,
  credentials: ChatGptSubscriptionCredentials | null,
): AppSettings {
  return {
    ...settings,
    providerConfigurations: {
      ...settings.providerConfigurations,
      'chatgpt-subscription': {
        ...(settings.providerConfigurations['chatgpt-subscription'] ?? {
          endpoint: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-5-codex',
        }),
        chatGptSubscriptionCredentials: credentials,
      },
    },
  };
}