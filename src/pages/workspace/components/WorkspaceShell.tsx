import { useState, type CSSProperties, type ReactNode } from 'react';
import workspaceShellStyles from './WorkspaceShell.module.css';
import { DiagramCanvas } from '../../../components/diagram/DiagramCanvas';
import { useChat } from '../../../providers/chat/ChatContext';
import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { useWorkspaceTabManager } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import { SidebarResizer } from './SidebarResizer';
import { UnsupportedFileView } from './UnsupportedFileView';
import { WorkspaceActivityRail } from './WorkspaceActivityRail';
import { WorkspaceExplorer } from './WorkspaceExplorer';
import { WorkspaceStatusBar } from './WorkspaceStatusBar';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { useSidebarResize } from '../hooks/useSidebarResize';

function dispatchAssistantPaneEvent(eventName: 'archimedes:open-settings' | 'archimedes:open-chat') {
  window.dispatchEvent(new Event(eventName));
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { settings, root, setDiagramApi, openWorkspaceRoot, isOpeningRoot } = useWorkspace();
  const {
    activeTab,
    activeTabId,
    activeSnapshot,
    activeDocumentKey,
    tabs,
    handleSnapshotChange,
    switchTab,
    closeTab,
    closeActiveTab,
    closeSavedTabs,
    closeAllTabs,
    clearActiveCanvasContents,
    saveTab,
    openUntitledTab,
  } = useWorkspaceTabManager();
  const { handleWorkspaceSnapshotChanged, handleReview, isBusy, status } = useChat();
  const { sidebarWidth, handleResizePointerDown, handleResizeKeyDown } = useSidebarResize();
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);
  const [isAssistantCollapsed, setIsAssistantCollapsed] = useState(false);

  const handleOpenSettings = () => {
    setIsAssistantCollapsed(false);
    dispatchAssistantPaneEvent('archimedes:open-settings');
  };

  const handleToggleAssistant = () => {
    const nextIsCollapsed = !isAssistantCollapsed;
    setIsAssistantCollapsed(nextIsCollapsed);
    if (!nextIsCollapsed) dispatchAssistantPaneEvent('archimedes:open-chat');
  };

  return (
    <main
      className={`app-shell theme-${settings.theme} ${workspaceShellStyles.moduleAnchor}${isExplorerCollapsed ? ' is-explorer-collapsed' : ''}${isAssistantCollapsed ? ' is-assistant-collapsed' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <WorkspaceTopBar
        root={root}
        activeTab={activeTab}
        settings={settings}
        assistantStatus={status}
        isAssistantBusy={isBusy}
        isOpeningRoot={isOpeningRoot}
        isExplorerCollapsed={isExplorerCollapsed}
        isAssistantCollapsed={isAssistantCollapsed}
        onToggleExplorer={() => setIsExplorerCollapsed((current) => !current)}
        onToggleAssistant={handleToggleAssistant}
        onOpenWorkspaceRoot={openWorkspaceRoot}
        onOpenUntitledTab={openUntitledTab}
        onSaveActiveTab={() => {
          if (activeTabId) return saveTab(activeTabId);
          return undefined;
        }}
        onReview={() => handleReview()}
        onOpenSettings={handleOpenSettings}
      />

      <div className="workspace-main">
        <WorkspaceActivityRail
          isExplorerCollapsed={isExplorerCollapsed}
          isAssistantCollapsed={isAssistantCollapsed}
          onToggleExplorer={() => setIsExplorerCollapsed((current) => !current)}
          onToggleAssistant={handleToggleAssistant}
          onNewLocalDraft={openUntitledTab}
          onOpenSettings={handleOpenSettings}
        />

        {!isExplorerCollapsed ? <WorkspaceExplorer /> : null}

        <section className="canvas-pane" aria-label="Diagram editor">
          <WorkspaceTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSwitchTab={switchTab}
            onCloseTab={closeTab}
            onSaveTab={saveTab}
            onSaveActiveTab={() => {
              if (activeTabId) return saveTab(activeTabId);
              return undefined;
            }}
            onCloseActiveTab={closeActiveTab}
            onCloseSavedTabs={closeSavedTabs}
            onCloseAllTabs={closeAllTabs}
            onClearActiveCanvas={clearActiveCanvasContents}
            onOpenUntitledTab={openUntitledTab}
          />
          <div className="workspace-editor-body">
            {activeTab?.loadState === 'error' ? (
              <div className="unsupported-file-view">
                <div>
                  <p className="workspace-eyebrow">Could not load</p>
                  <h2>{activeTab.title}</h2>
                  <p>{activeTab.error}</p>
                </div>
              </div>
            ) : activeTab?.loadState === 'loading' ? (
              <div className="unsupported-file-view">
                <div>
                  <p className="workspace-eyebrow">Loading</p>
                  <h2>{activeTab.title}</h2>
                  <p>Reading file contents…</p>
                </div>
              </div>
            ) : activeTab && !activeTab.isSupported ? (
              <UnsupportedFileView tab={activeTab} />
            ) : activeTab ? (
              <DiagramCanvas
                key={activeDocumentKey ?? activeTab.id}
                documentKey={activeDocumentKey ?? activeTab.id}
                initialSnapshot={activeSnapshot}
                theme={settings.theme}
                onSnapshotChange={(snapshot) => {
                  if (handleSnapshotChange(activeTab.id, snapshot)) {
                    handleWorkspaceSnapshotChanged();
                  }
                }}
                onApiReady={setDiagramApi}
              />
            ) : (
              <div className="workspace-start-view">
                <div>
                  <p className="workspace-eyebrow">No file open</p>
                  <h2>Open a diagram when you are ready.</h2>
                  <p>
                    Open a folder to work with real .excalidraw files, or start an untitled diagram that
                    saves in this browser and reopens after refresh.
                  </p>
                  <div className="workspace-start-actions">
                    <button type="button" onClick={openWorkspaceRoot} disabled={isOpeningRoot}>
                      {isOpeningRoot ? 'Opening…' : 'Open folder'}
                    </button>
                    <button type="button" onClick={openUntitledTab}>New untitled diagram</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {!isAssistantCollapsed ? (
          <>
            <SidebarResizer
              sidebarWidth={sidebarWidth}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
            />
            <aside className="assistant-panel" aria-label="Archimedes assistant">
              {children}
            </aside>
          </>
        ) : null}
      </div>

      <WorkspaceStatusBar
        root={root}
        activeTab={activeTab}
        activeSnapshot={activeSnapshot}
        settings={settings}
        assistantStatus={status}
        isAssistantBusy={isBusy}
      />
    </main>
  );
}
