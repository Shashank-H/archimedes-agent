import type { IconName } from '../components/ui/icons';

export const ASSISTANT_PANE_VIEW_IDS = {
  chat: 'chat',
  settings: 'settings',
} as const;

export type AssistantPaneView = (typeof ASSISTANT_PANE_VIEW_IDS)[keyof typeof ASSISTANT_PANE_VIEW_IDS];

export type AssistantPaneViewDefinition = {
  id: AssistantPaneView;
  label: string;
  toggleLabel: string;
  toggleAriaLabel: string;
  toggleTooltipLabel: string;
  toggleIconName: IconName;
};

export const ASSISTANT_PANE_VIEWS: readonly AssistantPaneViewDefinition[] = [
  {
    id: ASSISTANT_PANE_VIEW_IDS.chat,
    label: 'Chat',
    toggleLabel: 'Chat',
    toggleAriaLabel: 'Back to chat',
    toggleTooltipLabel: 'Back to chat',
    toggleIconName: 'message',
  },
  {
    id: ASSISTANT_PANE_VIEW_IDS.settings,
    label: 'Settings',
    toggleLabel: 'Settings',
    toggleAriaLabel: 'Open settings',
    toggleTooltipLabel: 'Settings',
    toggleIconName: 'settings',
  },
];

export const DEFAULT_ASSISTANT_PANE_VIEW = ASSISTANT_PANE_VIEW_IDS.chat;
