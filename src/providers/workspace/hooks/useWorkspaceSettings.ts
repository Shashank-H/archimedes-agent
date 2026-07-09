import { useCallback, useEffect, useState } from 'react';
import { setAnalyticsUsageConsent } from '../../../lib/analytics';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { appStorage } from '../../../lib/storage';
import type { AppSettings, AppTheme } from '../../../types';

export type ThemeBase = 'light' | 'dark';

export function getEffectiveBaseTheme(theme: AppTheme): ThemeBase {
  if (theme === 'light' || theme === 'sepia') return 'light';
  // coffee and any future dark variations
  return 'dark';
}

function getThemeClass(theme: AppTheme): string {
  return `theme-${theme}`;
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => appStorage.loadSettings());

  const effectiveBase = getEffectiveBaseTheme(settings.theme);

  useEffect(() => {
    appStorage.saveSettings(settings);
    setAnalyticsUsageConsent(settings.sendAnonymizedUsageLogs);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;

    // Clean previous theme-* classes
    root.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) {
        root.classList.remove(cls);
      }
    });

    // Apply the specific theme class (light, dark, coffee, sepia, ...)
    const themeClass = getThemeClass(settings.theme);
    root.classList.add(themeClass);

    // Maintain legacy classes for components that still key off theme-dark / theme-light
    root.classList.toggle('theme-dark', effectiveBase === 'dark');
    root.classList.toggle('theme-light', effectiveBase === 'light');

    root.style.colorScheme = effectiveBase;

    return () => {
      root.classList.remove(themeClass, 'theme-dark', 'theme-light');
      root.style.removeProperty('color-scheme');
    };
  }, [settings.theme, effectiveBase]);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(llmProviderFactory.withActiveConfiguration(nextSettings));
  }, []);

  return { settings, setSettings, handleSettingsChange, effectiveBase };
}
