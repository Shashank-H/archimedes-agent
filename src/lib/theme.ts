import type { AppTheme } from '../types';

export type BaseTheme = 'light' | 'dark';

export type AppThemeOption = {
  value: AppTheme;
  label: string;
  description: string;
};

type AppThemeMetadata = AppThemeOption & {
  baseTheme: BaseTheme;
  classes: string[];
};

export const APP_THEME_METADATA = {
  light: {
    value: 'light',
    label: 'Light',
    description: 'A bright theme for well-lit workspaces.',
    baseTheme: 'light',
    classes: ['theme-light'],
  },
  dark: {
    value: 'dark',
    label: 'Dark',
    description: 'A high-contrast dark theme.',
    baseTheme: 'dark',
    classes: ['theme-dark'],
  },
  'slate-dusk': {
    value: 'slate-dusk',
    label: 'Slate Dusk',
    description: 'A soft charcoal IDE theme with slate surfaces.',
    baseTheme: 'dark',
    classes: ['theme-dark', 'theme-slate-dusk'],
  },
} as const satisfies Record<AppTheme, AppThemeMetadata>;

export const APP_THEME_OPTIONS: AppThemeOption[] = Object.values(APP_THEME_METADATA).map(({ value, label, description }) => ({
  value,
  label,
  description,
}));

export const APP_THEME_CLASSES = Array.from(new Set(Object.values(APP_THEME_METADATA).flatMap((theme) => theme.classes)));

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && value in APP_THEME_METADATA;
}

export function toEffectiveBaseTheme(theme: AppTheme): BaseTheme {
  return APP_THEME_METADATA[theme].baseTheme;
}

export function getThemeClasses(theme: AppTheme): string[] {
  return [...APP_THEME_METADATA[theme].classes];
}
