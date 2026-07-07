import { useMemo, useRef, useState } from 'react';
import { loginOpenAICodexDeviceCode, type OpenAiCodexDeviceCodeInfo } from '../lib/llm/chatgptSubscription';
import { openExternalUrl } from '../lib/openExternalUrl';
import { CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT, type AppSettings, type ChatGptSubscriptionCredentials } from '../types';

type AuthStatus = 'idle' | 'waiting' | 'signed-in' | 'error';

function subscriptionConfiguration(settings: AppSettings) {
  return settings.providerConfigurations['chatgpt-subscription'];
}

function credentialLabel(credentials?: ChatGptSubscriptionCredentials | null) {
  if (!credentials) return '';
  return credentials.email || credentials.name || credentials.accountId;
}

export function useChatGptSubscriptionAuth(settings: AppSettings, onSettingsChange: (settings: AppSettings) => void) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const credentials = subscriptionConfiguration(settings)?.chatGptSubscriptionCredentials ?? null;
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<OpenAiCodexDeviceCodeInfo | null>(null);
  const [status, setStatus] = useState<AuthStatus>(credentials ? 'signed-in' : 'idle');
  const [error, setError] = useState('');

  const signedInLabel = useMemo(() => credentialLabel(credentials), [credentials]);

  const applyCredentials = (nextCredentials: ChatGptSubscriptionCredentials | null) => {
    onSettingsChange({
      ...settings,
      providerConfigurations: {
        ...settings.providerConfigurations,
        'chatgpt-subscription': {
          ...(subscriptionConfiguration(settings) ?? { endpoint: CHATGPT_SUBSCRIPTION_DEFAULT_ENDPOINT, apiKey: '', model: 'gpt-5-codex' }),
          chatGptSubscriptionCredentials: nextCredentials,
        },
      },
    });
  };

  const signIn = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('waiting');
    setError('');
    setDeviceCodeInfo(null);

    try {
      const nextCredentials = await loginOpenAICodexDeviceCode({
        signal: controller.signal,
        onDeviceCode: (info) => {
          setDeviceCodeInfo(info);
          void navigator.clipboard?.writeText(info.userCode).catch(() => undefined);
          void openExternalUrl(info.verificationUri).catch((openError) => {
            setError(openError instanceof Error ? openError.message : String(openError));
          });
        },
      });
      applyCredentials(nextCredentials);
      setStatus('signed-in');
      setDeviceCodeInfo(null);
    } catch (signInError) {
      if (controller.signal.aborted) {
        setStatus(credentials ? 'signed-in' : 'idle');
      } else {
        setStatus('error');
        setError(signInError instanceof Error ? signInError.message : String(signInError));
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const cancelSignIn = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setDeviceCodeInfo(null);
    setStatus(credentials ? 'signed-in' : 'idle');
  };

  const signOut = () => {
    cancelSignIn();
    applyCredentials(null);
    setStatus('idle');
    setError('');
  };

  return {
    credentials,
    signedInLabel,
    deviceCodeInfo,
    status,
    error,
    isSigningIn: status === 'waiting',
    signIn,
    cancelSignIn,
    signOut,
    applyCredentials,
  };
}