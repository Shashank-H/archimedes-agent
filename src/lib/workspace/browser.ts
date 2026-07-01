import { parseExcalidrawFile, serializeExcalidrawFile } from '../excalidrawFile';
import type { DiagramSnapshot } from '../../types';
import type {
  WorkspaceDataProvider,
  WorkspaceDocument,
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceOpenRootResult,
  WorkspaceRoot,
} from './types';
import { isSupportedDiagramPath } from './types';

type DirectoryHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

type StoredHandle = DirectoryHandle | FileHandle;

const browserHandles = new Map<string, StoredHandle>();
const browserHandlePaths = new Map<string, string>();
let rootCounter = 0;

function hasFileSystemAccessApi() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function extensionFor(name: string) {
  const match = name.match(/(\.excalidraw\.json|\.[^.]+)$/i);
  return match?.[1];
}

export class BrowserWorkspaceProvider implements WorkspaceDataProvider {
  readonly kind = 'browser' as const;
  readonly capabilities = {
    canOpenDirectory: hasFileSystemAccessApi(),
    canWrite: hasFileSystemAccessApi(),
    canRefresh: hasFileSystemAccessApi(),
    canWatch: false,
  };

  async openRoot(): Promise<WorkspaceOpenRootResult> {
    if (!hasFileSystemAccessApi()) throw new Error('This browser does not support folder workspaces.');

    const picker = (window as typeof window & {
      showDirectoryPicker: () => Promise<DirectoryHandle>;
    }).showDirectoryPicker;
    const handle = await picker();
    const rootId = `browser://workspace-${++rootCounter}` as const;
    browserHandles.set(rootId, handle);
    browserHandlePaths.set(rootId, handle.name);

    const root: WorkspaceRoot = {
      id: rootId,
      providerKind: this.kind,
      name: handle.name,
      path: handle.name,
    };

    return { root, children: await this.readDirectory(root, handle, null, handle.name) };
  }

  async listChildren(root: WorkspaceRoot, directoryId: WorkspaceFileId): Promise<WorkspaceEntry[]> {
    const handle = browserHandles.get(directoryId);
    if (!handle || handle.kind !== 'directory') throw new Error('Browser directory handle is no longer available.');
    return this.readDirectory(root, handle, directoryId, browserHandlePaths.get(directoryId) ?? root.path);
  }

  async readDocument(entry: WorkspaceEntry): Promise<WorkspaceDocument> {
    const handle = browserHandles.get(entry.id);
    if (!handle || handle.kind !== 'file') throw new Error('Browser file handle is no longer available.');

    if (!entry.isSupported || !isSupportedDiagramPath(entry.path)) {
      return {
        id: entry.id,
        providerKind: this.kind,
        rootId: entry.rootId,
        title: entry.name,
        path: entry.path,
        snapshot: null,
        isUntitled: false,
        isSupported: false,
      };
    }

    const file = await handle.getFile();
    return {
      id: entry.id,
      providerKind: this.kind,
      rootId: entry.rootId,
      title: entry.name,
      path: entry.path,
      snapshot: parseExcalidrawFile(await file.text()),
      isUntitled: false,
      isSupported: true,
    };
  }

  async writeDocument(document: WorkspaceDocument, snapshot: DiagramSnapshot): Promise<void> {
    const handle = browserHandles.get(document.id);
    if (!handle || handle.kind !== 'file') throw new Error('Browser file handle is no longer available.');

    const writable = await handle.createWritable();
    await writable.write(serializeExcalidrawFile(snapshot));
    await writable.close();
  }

  private async readDirectory(
    root: WorkspaceRoot,
    handle: DirectoryHandle,
    parentId: WorkspaceFileId | null,
    parentPath: string,
  ): Promise<WorkspaceEntry[]> {
    const entries: WorkspaceEntry[] = [];
    const iterableHandle = handle as DirectoryHandle & {
      values: () => AsyncIterable<DirectoryHandle | FileHandle>;
    };

    for await (const child of iterableHandle.values()) {
      const path = parentId ? `${parentPath}/${child.name}` : child.name;
      const id = `${root.id}/${path}` as WorkspaceFileId;
      browserHandles.set(id, child);
      browserHandlePaths.set(id, path);
      entries.push({
        id,
        rootId: root.id,
        providerKind: this.kind,
        kind: child.kind === 'directory' ? 'directory' : 'file',
        name: child.name,
        path,
        parentId,
        extension: child.kind === 'file' ? extensionFor(child.name) : undefined,
        isSupported: child.kind === 'file' && isSupportedDiagramPath(child.name),
      });
    }
    return entries.sort((a, b) => Number(a.kind === 'file') - Number(b.kind === 'file') || a.name.localeCompare(b.name));
  }
}

export const browserWorkspaceProvider = new BrowserWorkspaceProvider();
