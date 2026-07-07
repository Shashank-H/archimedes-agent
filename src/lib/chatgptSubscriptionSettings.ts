import { CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT, type AppSettings, type ChatGptSubscriptionCredentials } from '../types';

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
          endpoint: CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT,
          apiKey: '',
          model: 'gpt-5-codex',
        }),
        chatGptSubscriptionCredentials: credentials,
      },
    },
  };
}