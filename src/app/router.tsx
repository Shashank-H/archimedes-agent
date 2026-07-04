import type { ComponentType } from 'react';
import { AssistantHeader } from '../components/ui/AssistantHeader';
import { ChatPage } from '../pages/chat/ChatPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { useChat } from '../providers/chat/ChatContext';
import { ASSISTANT_PANE_VIEW_IDS, type AssistantPaneView } from './constants';
import { useAssistantPaneNavigation } from './hooks/useAssistantPaneNavigation';

const ASSISTANT_PANE_COMPONENT_BY_VIEW: Record<AssistantPaneView, ComponentType> = {
  [ASSISTANT_PANE_VIEW_IDS.chat]: ChatPage,
  [ASSISTANT_PANE_VIEW_IDS.settings]: SettingsPage,
};

export function AssistantPaneRouter() {
  const { status } = useChat();
  const { activeView, toggleTargetViewDefinition, toggleView } = useAssistantPaneNavigation();
  const ActivePaneComponent = ASSISTANT_PANE_COMPONENT_BY_VIEW[activeView];

  return (
    <>
      <AssistantHeader
        status={status}
        toggleAction={{
          label: toggleTargetViewDefinition.toggleLabel,
          ariaLabel: toggleTargetViewDefinition.toggleAriaLabel,
          tooltipLabel: toggleTargetViewDefinition.toggleTooltipLabel,
          iconName: toggleTargetViewDefinition.toggleIconName,
        }}
        onToggleView={toggleView}
      />
      <ActivePaneComponent />
    </>
  );
}
