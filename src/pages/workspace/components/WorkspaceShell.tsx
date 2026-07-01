import { type CSSProperties, type ReactNode } from 'react';
import { DiagramCanvas } from '../../../components/diagram/DiagramCanvas';
import { useChat } from '../../../providers/chat/ChatContext';
import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { SidebarResizer } from './SidebarResizer';
import { useSidebarResize } from '../hooks/useSidebarResize';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { settings, initialSnapshot, handleSnapshotChange, setDiagramApi } = useWorkspace();
  const { handleWorkspaceSnapshotChanged } = useChat();
  const { sidebarWidth, handleResizePointerDown, handleResizeKeyDown } = useSidebarResize();

  return (
    <main
      className={`app-shell theme-${settings.theme}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <section className="canvas-pane">
        <DiagramCanvas
          initialSnapshot={initialSnapshot}
          theme={settings.theme}
          onSnapshotChange={(snapshot) => {
            handleSnapshotChange(snapshot);
            handleWorkspaceSnapshotChanged();
          }}
          onApiReady={setDiagramApi}
        />
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
