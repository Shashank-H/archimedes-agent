import type { IconName } from '../../components/ui/icons';

export type SettingsSectionId =
  | 'provider'
  | 'assistant'
  | 'shortcuts'
  | 'appearance'
  | 'privacy'
  | 'about';

export type SettingsSectionDefinition = {
  id: SettingsSectionId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  iconName: IconName;
};

export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  {
    id: 'provider',
    label: 'Provider',
    eyebrow: 'Model provider',
    title: 'Provider configuration',
    description: 'Choose the model provider, endpoint, API credentials, model, and generation temperature used across Archimedes.',
    iconName: 'plug',
  },
  {
    id: 'assistant',
    label: 'Assistant',
    eyebrow: 'Assistant behavior',
    title: 'Assistant review behavior',
    description: 'Tune proactive review timing and whether automatic reviews include prior chat context.',
    iconName: 'message',
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    eyebrow: 'Keyboard',
    title: 'Keyboard shortcuts',
    description: 'Review the keyboard shortcuts available in the workspace.',
    iconName: 'sliders',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    eyebrow: 'Workspace',
    title: 'Appearance',
    description: 'Choose the workspace theme used by the editor, assistant, and settings.',
    iconName: 'settings',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    eyebrow: 'Diagnostics',
    title: 'Privacy and usage logs',
    description: 'Control anonymous product telemetry and review what this app never sends.',
    iconName: 'eye',
  },
  {
    id: 'about',
    label: 'About',
    eyebrow: 'Project',
    title: 'About Archimedes',
    description: 'Project links and open source attributions.',
    iconName: 'github',
  },
] as const;
