import { useCallback, useEffect, useState } from 'react';
import { setAnalyticsUsageConsent } from '../../../lib/analytics';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { appStorage } from '../../../lib/storage';
import { APP_THEME_CLASSES, getThemeClasses, toEffectiveBaseTheme } from '../../../lib/theme';
import type { AppSettings } from '../../../types';

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => appStorage.loadSettings());

  useEffect(() => {
    appStorage.saveSettings(settings);
    setAnalyticsUsageConsent(settings.sendAnonymizedUsageLogs);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    const themeClasses = getThemeClasses(settings.theme);
    root.classList.remove(...APP_THEME_CLASSES);
    root.classList.add(...themeClasses);
    root.style.colorScheme = toEffectiveBaseTheme(settings.theme);

    return () => {
      root.classList.remove(...themeClasses);
      root.style.removeProperty('color-scheme');
    };
  }, [settings.theme]);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(llmProviderFactory.withActiveConfiguration(nextSettings));
  }, []);

  return { settings, setSettings, handleSettingsChange };
}
