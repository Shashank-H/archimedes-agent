export const SHORTCUT_ACTION_IDS = {
  saveActiveTab: 'workspace.saveActiveTab',
} as const;

export type ShortcutActionId = (typeof SHORTCUT_ACTION_IDS)[keyof typeof SHORTCUT_ACTION_IDS];

export type ShortcutModifier = 'ctrl' | 'meta' | 'shift' | 'alt';

export type KeyboardShortcutDefinition = {
  id: ShortcutActionId;
  label: string;
  description: string;
  hotkey: string;
  key: string;
  modifiers: readonly ShortcutModifier[];
  displayKeys: readonly string[];
  scopeLabel: string;
  preventDefault: boolean;
};

export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcutDefinition[] = [
  {
    id: SHORTCUT_ACTION_IDS.saveActiveTab,
    label: 'Save active file',
    description: 'Writes the currently active workspace tab to disk.',
    hotkey: 'ctrl+s',
    key: 's',
    modifiers: ['ctrl'],
    displayKeys: ['Ctrl', 'S'],
    scopeLabel: 'Workspace',
    preventDefault: true,
  },
];
