import { useCallback, useEffect, useState, useMemo } from 'react';
import { setAnalyticsUsageConsent } from '../../../lib/analytics';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { appStorage } from '../../../lib/storage';
import type { AppSettings, AppTheme } from '../../../types';

function resolveEffectiveTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  if (theme === 'system' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (theme === 'coffee') return 'dark'; // coffee is a dark variation
  return 'light';
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => appStorage.loadSettings());

  const effectiveTheme = useMemo(() => resolveEffectiveTheme(settings.theme), [settings.theme]);

  useEffect(() => {
    appStorage.saveSettings(settings);
    setAnalyticsUsageConsent(settings.sendAnonymizedUsageLogs);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    // Remove previous theme- classes
    root.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) root.classList.remove(cls);
    });
    const themeClass = `theme-${settings.theme}`;
    root.classList.add(themeClass);
    // Also keep legacy for compat if needed
    if (effectiveTheme === 'dark') root.classList.add('theme-dark');
    if (effectiveTheme === 'light') root.classList.add('theme-light');

    root.style.colorScheme = effectiveTheme;

    return () => {
      root.classList.remove(themeClass, 'theme-dark', 'theme-light');
      root.style.removeProperty('color-scheme');
    };
  }, [settings.theme, effectiveTheme]);

  // Listen for system preference changes when using 'system'
  useEffect(() => {
    if (settings.theme !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const handler = () => {
      // trigger re-compute by cloning settings (cheap for this effect)
      setSettings((s) => ({ ...s }));
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [settings.theme]);

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(llmProviderFactory.withActiveConfiguration(nextSettings));
  }, []);

  return { settings, setSettings, handleSettingsChange, effectiveTheme };
}
