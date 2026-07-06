import { useEffect, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AppTooltip } from '../../../components/AppTooltip';
import { CustomHorizontalScrollbar } from '../../../components/ui/CustomHorizontalScrollbar';
import { Icon } from '../../../components/ui/icons';
import { canSaveWorkspaceTab } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import type { WorkspaceFileId, WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceTabsProps = {
  tabs: WorkspaceTab[];
  activeTabId: WorkspaceFileId | null;
  onSwitchTab: (tabId: WorkspaceFileId) => void;
  onCloseTab: (tabId: WorkspaceFileId) => void;
  onSaveTab: (tabId: WorkspaceFileId) => void | Promise<void>;
  onSaveActiveTab: () => void | Promise<void>;
  onCloseActiveTab: () => void;
  onCloseSavedTabs: () => void;
  onCloseAllTabs: () => void;
  onClearActiveCanvas: () => void;
  onOpenUntitledTab: () => void;
};

function saveStateLabel(tab: WorkspaceTab) {
  if (tab.isUntitled && tab.saveState === 'saved') return 'Saved locally';
  if (tab.isUntitled && tab.saveState === 'dirty') return 'Unsaved local changes';
  if (tab.saveState === 'dirty') return 'Unsaved changes';
  if (tab.saveState === 'saving') return 'Saving…';
  if (tab.saveState === 'error') return tab.error ?? 'Save error';
  return null;
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

function WorkspaceTabOptionsMenu({
  activeTab,
  hasTabs,
  hasSavedTabs,
  onSaveActiveTab,
  onCloseActiveTab,
  onCloseSavedTabs,
  onCloseAllTabs,
  onClearActiveCanvas,
  onOpenUntitledTab,
}: {
  activeTab: WorkspaceTab | null;
  hasTabs: boolean;
  hasSavedTabs: boolean;
  onSaveActiveTab: () => void | Promise<void>;
  onCloseActiveTab: () => void;
  onCloseSavedTabs: () => void;
  onCloseAllTabs: () => void;
  onClearActiveCanvas: () => void;
  onOpenUntitledTab: () => void;
}) {
  const canSaveActiveTab = canSaveWorkspaceTab(activeTab);
  const canClearActiveCanvas = Boolean(activeTab?.isSupported && activeTab.loadState === 'loaded');

  return (
    <DropdownMenu.Root>
      <AppTooltip label="Tab options" side="bottom" align="end">
        <DropdownMenu.Trigger asChild>
          <button type="button" className="workspace-tabs-menu-trigger" aria-label="Open tab options">
            <Icon name="sliders" size={14} />
          </button>
        </DropdownMenu.Trigger>
      </AppTooltip>
      <DropdownMenu.Content className="workspace-tabs-menu" side="bottom" align="end" sideOffset={5}>
        <DropdownMenu.Item className="workspace-tabs-menu-item" onSelect={() => onOpenUntitledTab()}>
          New untitled diagram
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className="workspace-tabs-menu-item"
          disabled={!canSaveActiveTab}
          onSelect={() => void onSaveActiveTab()}
        >
          {canSaveActiveTab && activeTab?.saveState === 'error' ? 'Retry save active file' : 'Save active file'}
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="workspace-tabs-menu-separator" />
        <DropdownMenu.Item
          className="workspace-tabs-menu-item"
          disabled={!canClearActiveCanvas}
          onSelect={() => void onClearActiveCanvas()}
        >
          Clear active canvas
        </DropdownMenu.Item>
        <DropdownMenu.Separator className="workspace-tabs-menu-separator" />
        <DropdownMenu.Item
          className="workspace-tabs-menu-item"
          disabled={!activeTab}
          onSelect={() => void onCloseActiveTab()}
        >
          Close active tab
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className="workspace-tabs-menu-item"
          disabled={!hasSavedTabs}
          onSelect={() => onCloseSavedTabs()}
        >
          Close saved tabs
        </DropdownMenu.Item>
        <DropdownMenu.Item
          className="workspace-tabs-menu-item is-danger"
          disabled={!hasTabs}
          onSelect={() => void onCloseAllTabs()}
        >
          Close all tabs
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onSaveTab,
  onSaveActiveTab,
  onCloseActiveTab,
  onCloseSavedTabs,
  onCloseAllTabs,
  onClearActiveCanvas,
  onOpenUntitledTab,
}: WorkspaceTabsProps) {
  const activeTabRef = useRef<HTMLDivElement | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const hasSavedTabs = tabs.some((tab) => tab.saveState === 'saved');

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activeTabId, tabs.length]);

  return (
    <div className="workspace-tabs-bar">
      <CustomHorizontalScrollbar
        className="workspace-tabs-shell"
        viewportClassName="workspace-tabs"
        viewportProps={{ role: 'tablist', 'aria-label': 'Open diagrams' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const status = saveStateLabel(tab);
          const showSaveButton = isActive && canSaveWorkspaceTab(tab);

          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              className={`workspace-tab${isActive ? ' is-active' : ''}`}
              role="presentation"
            >
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
                  aria-label={`Save ${tab.title}`}
                >
                  {tab.saveState === 'error' ? 'Retry' : 'Save'}
                </button>
              )}
              <button
                type="button"
                className="workspace-tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  void onCloseTab(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </CustomHorizontalScrollbar>
      <div className="workspace-tabs-actions" aria-label="Tab actions">
        <WorkspaceTabOptionsMenu
          activeTab={activeTab}
          hasTabs={tabs.length > 0}
          hasSavedTabs={hasSavedTabs}
          onSaveActiveTab={onSaveActiveTab}
          onCloseActiveTab={onCloseActiveTab}
          onCloseSavedTabs={onCloseSavedTabs}
          onCloseAllTabs={onCloseAllTabs}
          onClearActiveCanvas={onClearActiveCanvas}
          onOpenUntitledTab={onOpenUntitledTab}
        />
      </div>
    </div>
  );
}
