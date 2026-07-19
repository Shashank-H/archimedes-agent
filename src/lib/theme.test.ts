import { describe, expect, it } from 'vitest';
import {
  APP_THEME_OPTIONS,
  getThemeClasses,
  isAppTheme,
  toEffectiveBaseTheme,
} from './theme';

describe('app theme helpers', () => {
  it('maps Slate Dusk to the dark canvas mode while preserving a named class', () => {
    expect(toEffectiveBaseTheme('slate-dusk')).toBe('dark');
    expect(getThemeClasses('slate-dusk')).toEqual(['theme-dark', 'theme-slate-dusk']);
  });

  it('exposes Slate Dusk as a selectable dark theme', () => {
    expect(APP_THEME_OPTIONS).toContainEqual({
      value: 'slate-dusk',
      label: 'Slate Dusk',
      description: 'A soft charcoal IDE theme with slate surfaces.',
    });
  });

  it('recognizes supported persisted themes and rejects unknown values', () => {
    expect(isAppTheme('slate-dusk')).toBe(true);
    expect(isAppTheme('dark')).toBe(true);
    expect(isAppTheme('midnight')).toBe(false);
  });
});
