import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { applyCodexAuth, openAiCodexAuthService, type CodexDeviceAuthStart } from '../lib/llm/codex';
import type { AppSettings } from '../types';

type UseCodexAuthArgs = {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
};

const DEVICE_AUTH_TIMEOUT_MS = 15 * 60 * 1000;

async function openVerificationUrl(url: string) {
  try {
    await invoke('plugin:opener|open_url', { url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function useCodexAuth({ settings, onSettingsChange }: UseCodexAuthArgs) {
  const [deviceAuth, setDeviceAuth] = useState<CodexDeviceAuthStart | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [deviceCodeCopied, setDeviceCodeCopied] = useState(false);
  const pollTimeoutRef = useRef<number | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const deadlineRef = useRef<number>(0);

  const clearPoll = () => {
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    pollTimeoutRef.current = null;
  };

  const clearCopyReset = () => {
    if (copyResetTimeoutRef.current) window.clearTimeout(copyResetTimeoutRef.current);
    copyResetTimeoutRef.current = null;
  };

  useEffect(() => () => {
    clearPoll();
    clearCopyReset();
  }, []);

  const completeSignIn = (auth: NonNullable<AppSettings['codexAuth']>) => {
    clearPoll();
    clearCopyReset();
    setIsSigningIn(false);
    setStatus('Signed in with ChatGPT. Save to verify the selected Codex model.');
    setError(null);
    setDeviceAuth(null);
    setDeviceCodeCopied(false);
    onSettingsChange(applyCodexAuth(settings, auth));
  };

  const schedulePoll = (auth: CodexDeviceAuthStart) => {
    clearPoll();
    pollTimeoutRef.current = window.setTimeout(async () => {
      try {
        if (Date.now() >= deadlineRef.current) {
          setIsSigningIn(false);
          setError('OpenAI Codex sign-in timed out. Start sign-in again.');
          return;
        }
        const result = await openAiCodexAuthService.pollDeviceAuth(auth.deviceAuthId, auth.userCode);
        if (result) {
          completeSignIn(result);
          return;
        }
        schedulePoll(auth);
      } catch (pollError) {
        setIsSigningIn(false);
        setError(pollError instanceof Error ? pollError.message : 'OpenAI Codex sign-in failed.');
      }
    }, Math.max(3, auth.intervalSeconds) * 1000);
  };

  const copyDeviceCode = async (auth = deviceAuth) => {
    if (!auth?.userCode) return false;
    try {
      await navigator.clipboard?.writeText(auth.userCode);
      clearCopyReset();
      setDeviceCodeCopied(true);
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setDeviceCodeCopied(false);
        copyResetTimeoutRef.current = null;
      }, 1600);
      return true;
    } catch {
      setDeviceCodeCopied(false);
      return false;
    }
  };

  const openDeviceAuthUrl = async (auth = deviceAuth) => {
    if (!auth?.verificationUrl) return;
    await openVerificationUrl(auth.verificationUrl);
  };

  const startSignIn = async () => {
    clearPoll();
    clearCopyReset();
    setIsSigningIn(true);
    setDeviceCodeCopied(false);
    setError(null);
    setStatus('Requesting an OpenAI device code...');
    try {
      const auth = await openAiCodexAuthService.startDeviceAuth();
      setDeviceAuth(auth);
      const copied = await copyDeviceCode(auth);
      setStatus(copied ? 'Device code copied. Paste it in the browser window to finish sign-in.' : 'Paste the device code in the browser window to finish sign-in.');
      deadlineRef.current = Date.now() + Math.min((auth.expiresInSeconds || 900) * 1000, DEVICE_AUTH_TIMEOUT_MS);
      await openDeviceAuthUrl(auth);
      schedulePoll(auth);
    } catch (startError) {
      setIsSigningIn(false);
      setError(startError instanceof Error ? startError.message : 'Could not start OpenAI Codex sign-in.');
    }
  };

  const signOut = () => {
    clearPoll();
    setIsSigningIn(false);
    clearCopyReset();
    setDeviceAuth(null);
    setDeviceCodeCopied(false);
    setStatus('Signed out of OpenAI Codex.');
    setError(null);
    onSettingsChange(applyCodexAuth(settings, { accessToken: '', refreshToken: '', lastRefreshAt: Date.now() }));
  };

  return {
    deviceAuth,
    status,
    error,
    isSigningIn,
    isSignedIn: Boolean(settings.codexAuth?.accessToken),
    deviceCodeCopied,
    copyDeviceCode,
    openDeviceAuthUrl,
    startSignIn,
    signOut,
  };
}
