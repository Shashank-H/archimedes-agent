import type { WorkspaceTab } from '../../../lib/workspace/types';

export function UnsupportedFileView({ tab }: { tab: WorkspaceTab }) {
  return (
    <div className="unsupported-file-view">
      <div>
        <p className="workspace-eyebrow">Unsupported file</p>
        <h2>{tab.title}</h2>
        <p>Only `.excalidraw` and `.excalidraw.json` files can be edited on the canvas.</p>
      </div>
    </div>
  );
}
