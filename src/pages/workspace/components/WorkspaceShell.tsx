import { type CSSProperties, type ReactNode } from 'react';
import { DiagramCanvas } from '../../../components/diagram/DiagramCanvas';
import { useChat } from '../../../providers/chat/ChatContext';
import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { useWorkspaceTabManager } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import { SidebarResizer } from './SidebarResizer';
import { UnsupportedFileView } from './UnsupportedFileView';
import { WorkspaceExplorer } from './WorkspaceExplorer';
import { WorkspaceTabs } from './WorkspaceTabs';
import { useSidebarResize } from '../hooks/useSidebarResize';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { settings, setDiagramApi, openWorkspaceRoot, isOpeningRoot } = useWorkspace();
  const {
    activeTab,
    activeTabId,
    activeSnapshot,
    tabs,
    handleSnapshotChange,
    switchTab,
    closeTab,
    saveTab,
    openUntitledTab,
  } = useWorkspaceTabManager();
  const { handleWorkspaceSnapshotChanged } = useChat();
  const { sidebarWidth, handleResizePointerDown, handleResizeKeyDown } = useSidebarResize();

  return (
    <main
      className={`app-shell theme-${settings.theme}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <WorkspaceExplorer />
      <section className="canvas-pane">
        <WorkspaceTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitchTab={switchTab}
          onCloseTab={closeTab}
          onSaveTab={saveTab}
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
              key={activeTab.id}
              documentKey={activeTab.id}
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
                  Open a folder to work with real .excalidraw files, or start a blank local draft that
                  saves only in this browser and reopens after refresh.
                </p>
                <div className="workspace-start-actions">
                  <button type="button" onClick={openWorkspaceRoot} disabled={isOpeningRoot}>
                    {isOpeningRoot ? 'Opening…' : 'Open folder'}
                  </button>
                  <button type="button" onClick={openUntitledTab}>New local draft</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      <SidebarResizer
        sidebarWidth={sidebarWidth}
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
      />
      <aside className="assistant-panel">
        {children}
      </aside>
    </main>
  );
}
