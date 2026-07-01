import { useCallback, useEffect, useState } from 'react';
import { setAnalyticsUsageConsent } from '../../../lib/analytics';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { appStorage } from '../../../lib/storage';
import type { AppSettings } from '../../../types';

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => appStorage.loadSettings());

  useEffect(() => {
    appStorage.saveSettings(settings);
    setAnalyticsUsageConsent(settings.sendAnonymizedUsageLogs);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', settings.theme === 'dark');
    root.classList.toggle('theme-light', settings.theme === 'light');
    root.style.colorScheme = settings.theme;

    return () => {
      root.classList.remove('theme-dark', 'theme-light');
      root.style.removeProperty('color-scheme');
    };
  }, [settings.theme]);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(llmProviderFactory.withActiveConfiguration(nextSettings));
  }, []);

  return { settings, setSettings, handleSettingsChange };
}
