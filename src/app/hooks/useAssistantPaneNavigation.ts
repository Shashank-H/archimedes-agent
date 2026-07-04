import { useCallback, useMemo, useState } from 'react';
import {
  ASSISTANT_PANE_VIEWS,
  DEFAULT_ASSISTANT_PANE_VIEW,
  type AssistantPaneView,
  type AssistantPaneViewDefinition,
} from '../constants';

const ASSISTANT_PANE_VIEW_SEQUENCE = ASSISTANT_PANE_VIEWS.map((view) => view.id);

const ASSISTANT_PANE_VIEW_BY_ID = ASSISTANT_PANE_VIEWS.reduce(
  (viewById, view) => ({ ...viewById, [view.id]: view }),
  {} as Record<AssistantPaneView, AssistantPaneViewDefinition>,
);

function getNextAssistantPaneView(currentView: AssistantPaneView) {
  const currentIndex = ASSISTANT_PANE_VIEW_SEQUENCE.indexOf(currentView);
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;

  return ASSISTANT_PANE_VIEW_SEQUENCE[nextIndex % ASSISTANT_PANE_VIEW_SEQUENCE.length] ?? DEFAULT_ASSISTANT_PANE_VIEW;
}

export function useAssistantPaneNavigation(initialView: AssistantPaneView = DEFAULT_ASSISTANT_PANE_VIEW) {
  const [activeView, setActiveView] = useState<AssistantPaneView>(initialView);

  const openView = useCallback((nextView: AssistantPaneView) => setActiveView(nextView), []);
  const isActiveView = useCallback((view: AssistantPaneView) => activeView === view, [activeView]);
  const toggleView = useCallback(() => {
    setActiveView((currentView) => getNextAssistantPaneView(currentView));
  }, []);

  const toggleTargetView = useMemo(() => getNextAssistantPaneView(activeView), [activeView]);

  return {
    activeView,
    activeViewDefinition: ASSISTANT_PANE_VIEW_BY_ID[activeView],
    toggleTargetView,
    toggleTargetViewDefinition: ASSISTANT_PANE_VIEW_BY_ID[toggleTargetView],
    openView,
    isActiveView,
    toggleView,
  };
}
