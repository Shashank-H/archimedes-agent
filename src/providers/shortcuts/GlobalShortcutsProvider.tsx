import { useMemo, type ReactNode } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useWorkspaceTabManager } from '../workspace/tabs/WorkspaceTabManagerContext';
import { KEYBOARD_SHORTCUTS, SHORTCUT_ACTION_IDS, type ShortcutActionId } from './constants';

type ShortcutHandlerMap = Record<ShortcutActionId, () => void | Promise<void>>;

const SHORTCUTS_BY_HOTKEY = KEYBOARD_SHORTCUTS.reduce(
  (shortcutByHotkey, shortcut) => ({ ...shortcutByHotkey, [shortcut.hotkey]: shortcut }),
  {} as Record<string, (typeof KEYBOARD_SHORTCUTS)[number]>,
);

const GLOBAL_HOTKEYS = KEYBOARD_SHORTCUTS.map((shortcut) => shortcut.hotkey);

export function GlobalShortcutsProvider({ children }: { children: ReactNode }) {
  const { saveActiveTab } = useWorkspaceTabManager();
  const shortcutHandlers = useMemo<ShortcutHandlerMap>(() => ({
    [SHORTCUT_ACTION_IDS.saveActiveTab]: saveActiveTab,
  }), [saveActiveTab]);

  useHotkeys(
    GLOBAL_HOTKEYS,
    (event, hotkeysEvent) => {
      const shortcut = SHORTCUTS_BY_HOTKEY[hotkeysEvent.hotkey];
      if (!shortcut) return;

      if (shortcut.preventDefault) event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void shortcutHandlers[shortcut.id]?.();
    },
    {
      enableOnFormTags: true,
      preventDefault: (event, hotkeysEvent) => Boolean(SHORTCUTS_BY_HOTKEY[hotkeysEvent.hotkey]?.preventDefault),
      eventListenerOptions: { capture: true },
    },
    [shortcutHandlers],
  );

  return children;
}
