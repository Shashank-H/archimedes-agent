import type { WorkspaceFileId, WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceTabsProps = {
  tabs: WorkspaceTab[];
  activeTabId: WorkspaceFileId | null;
  onSwitchTab: (tabId: WorkspaceFileId) => void;
  onCloseTab: (tabId: WorkspaceFileId) => void;
};

function saveStateLabel(tab: WorkspaceTab) {
  if (tab.saveState === 'dirty') return 'Unsaved changes';
  if (tab.saveState === 'saving') return 'Saving…';
  if (tab.saveState === 'error') return 'Save error';
  return null;
}

export function WorkspaceTabs({ tabs, activeTabId, onSwitchTab, onCloseTab }: WorkspaceTabsProps) {
  return (
    <div className="workspace-tabs" role="tablist" aria-label="Open diagrams">
      {tabs.map((tab) => {
        const status = saveStateLabel(tab);
        return (
          <div key={tab.id} className={`workspace-tab${tab.id === activeTabId ? ' is-active' : ''}`} role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === activeTabId}
              className="workspace-tab-button"
              onClick={() => onSwitchTab(tab.id)}
              title={tab.path}
            >
              <span className="workspace-tab-title">{tab.title}</span>
              {status ? <span className={`workspace-tab-status is-${tab.saveState}`} title={status} /> : null}
            </button>
            <button
              type="button"
              className="workspace-tab-close"
              onClick={() => onCloseTab(tab.id)}
              aria-label={`Close ${tab.title}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
