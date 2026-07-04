import { AppTooltip } from '../../../components/AppTooltip';
import { CustomHorizontalScrollbar } from '../../../components/ui/CustomHorizontalScrollbar';
import type { WorkspaceFileId, WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceTabsProps = {
  tabs: WorkspaceTab[];
  activeTabId: WorkspaceFileId | null;
  onSwitchTab: (tabId: WorkspaceFileId) => void;
  onCloseTab: (tabId: WorkspaceFileId) => void;
  onSaveTab: (tabId: WorkspaceFileId) => void | Promise<void>;
};

function saveStateLabel(tab: WorkspaceTab) {
  if (tab.isUntitled && tab.saveState === 'saved') return 'Saved locally';
  if (tab.isUntitled && tab.saveState === 'dirty') return 'Unsaved local changes';
  if (tab.saveState === 'dirty') return 'Unsaved changes';
  if (tab.saveState === 'saving') return 'Saving…';
  if (tab.saveState === 'error') return 'Save error';
  return null;
}

function canSaveTab(tab: WorkspaceTab) {
  return tab.isSupported && tab.loadState === 'loaded' && tab.saveState !== 'saving';
}

function TabTooltipContent({ tab }: { tab: WorkspaceTab }) {
  const status = saveStateLabel(tab);

  return (
    <div className="workspace-tab-tooltip">
      <strong>{tab.title}</strong>
      <span>{tab.path}</span>
      {status && <em>{status}</em>}
    </div>
  );
}

export function WorkspaceTabs({ tabs, activeTabId, onSwitchTab, onCloseTab, onSaveTab }: WorkspaceTabsProps) {
  return (
    <CustomHorizontalScrollbar
      className="workspace-tabs-shell"
      viewportClassName="workspace-tabs"
      viewportProps={{ role: 'tablist', 'aria-label': 'Open diagrams' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const status = saveStateLabel(tab);
        const showSaveButton = isActive && tab.saveState === 'dirty';

        return (
          <div key={tab.id} className={`workspace-tab${isActive ? ' is-active' : ''}`} role="presentation">
            <AppTooltip label={<TabTooltipContent tab={tab} />} side="bottom" align="start">
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="workspace-tab-button"
                onClick={() => onSwitchTab(tab.id)}
              >
                <span className="workspace-tab-title">{tab.title}</span>
                {status ? <span className={`workspace-tab-status is-${tab.saveState}`} aria-label={status} /> : null}
              </button>
            </AppTooltip>
            {showSaveButton && (
              <button
                type="button"
                className="workspace-tab-save"
                onClick={(event) => {
                  event.stopPropagation();
                  void onSaveTab(tab.id);
                }}
                disabled={!canSaveTab(tab)}
                aria-label={`Save ${tab.title}`}
              >
                Save
              </button>
            )}
            <button
              type="button"
              className="workspace-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
              aria-label={`Close ${tab.title}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </CustomHorizontalScrollbar>
  );
}
