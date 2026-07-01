import { type CSSProperties, type ReactNode } from 'react';
import { DiagramCanvas } from '../../../components/diagram/DiagramCanvas';
import { useChat } from '../../../providers/chat/ChatContext';
import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { SidebarResizer } from './SidebarResizer';
import { UnsupportedFileView } from './UnsupportedFileView';
import { WorkspaceExplorer } from './WorkspaceExplorer';
import { WorkspaceTabs } from './WorkspaceTabs';
import { WorkspaceToolbar } from './WorkspaceToolbar';
import { useSidebarResize } from '../hooks/useSidebarResize';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const {
    settings,
    activeTab,
    activeTabId,
    activeSnapshot,
    tabs,
    handleSnapshotChange,
    setDiagramApi,
    switchTab,
    closeTab,
    saveActiveTab,
  } = useWorkspace();
  const { handleWorkspaceSnapshotChanged } = useChat();
  const { sidebarWidth, handleResizePointerDown, handleResizeKeyDown } = useSidebarResize();

  return (
    <main
      className={`app-shell theme-${settings.theme}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <WorkspaceExplorer />
      <section className="canvas-pane">
        <WorkspaceTabs tabs={tabs} activeTabId={activeTabId} onSwitchTab={switchTab} onCloseTab={closeTab} />
        <WorkspaceToolbar activeTab={activeTab} onSave={() => void saveActiveTab()} />
        <div className="workspace-editor-body">
          {activeTab?.loadState === 'error' ? (
            <div className="unsupported-file-view">
              <div>
                <p className="workspace-eyebrow">Could not load</p>
                <h2>{activeTab.title}</h2>
                <p>{activeTab.error}</p>
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
                handleSnapshotChange(snapshot);
                handleWorkspaceSnapshotChanged();
              }}
              onApiReady={setDiagramApi}
            />
          ) : null}
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
