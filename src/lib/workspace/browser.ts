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

const BROWSER_WORKSPACE_DB_NAME = 'archimedes-agent.workspaceHandles.v1';
const BROWSER_WORKSPACE_STORE_NAME = 'handles';
const BROWSER_WORKSPACE_ROOT_KEY = 'root';

function openBrowserWorkspaceHandleDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(BROWSER_WORKSPACE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(BROWSER_WORKSPACE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser workspace handle storage.'));
  });
}

async function saveBrowserWorkspaceRootHandle(handle: DirectoryHandle) {
  const database = await openBrowserWorkspaceHandleDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(BROWSER_WORKSPACE_STORE_NAME, 'readwrite');
    transaction.objectStore(BROWSER_WORKSPACE_STORE_NAME).put(handle, BROWSER_WORKSPACE_ROOT_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save browser workspace folder.'));
  });
  database.close();
}

async function loadBrowserWorkspaceRootHandle() {
  const database = await openBrowserWorkspaceHandleDatabase();
  const handle = await new Promise<DirectoryHandle | null>((resolve, reject) => {
    const transaction = database.transaction(BROWSER_WORKSPACE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(BROWSER_WORKSPACE_STORE_NAME).get(BROWSER_WORKSPACE_ROOT_KEY);
    request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not load browser workspace folder.'));
  });
  database.close();
  return handle;
}

function hasFileSystemAccessApi() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window && typeof indexedDB !== 'undefined';
}

function extensionFor(name: string) {
  const match = name.match(/(\.excalidraw\.json|\.[^.]+)$/i);
  return match?.[1];
}

function toExcalidrawFileName(name: string) {
  const cleanName = name.trim().replace(/[/\\]/g, '-');
  const baseName = cleanName || 'local-draft';
  return isSupportedDiagramPath(baseName) ? baseName : `${baseName}.excalidraw`;
}

async function ensureReadWritePermission(handle: StoredHandle) {
  const permissionHandle = handle as StoredHandle & {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  };
  const descriptor = { mode: 'readwrite' } as const;

  if ((await permissionHandle.queryPermission?.(descriptor)) === 'granted') return;
  if ((await permissionHandle.requestPermission?.(descriptor)) === 'granted') return;

  throw new Error('Write permission was not granted for this workspace file.');
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
      showDirectoryPicker: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>;
    }).showDirectoryPicker;
    const handle = await picker({ mode: 'readwrite' });
    await saveBrowserWorkspaceRootHandle(handle);
    return this.openRootFromHandle(handle);
  }

  async restoreRoot(): Promise<WorkspaceOpenRootResult> {
    if (!hasFileSystemAccessApi()) throw new Error('This browser does not support folder workspaces.');

    const handle = await loadBrowserWorkspaceRootHandle();
    if (!handle) throw new Error('No browser workspace folder was saved.');

    await ensureReadWritePermission(handle);
    return this.openRootFromHandle(handle);
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

    await ensureReadWritePermission(handle);

    const writable = await handle.createWritable();
    await writable.write(serializeExcalidrawFile(snapshot));
    await writable.close();
  }

  async createDocument(root: WorkspaceRoot, suggestedName: string, snapshot: DiagramSnapshot) {
    const rootHandle = browserHandles.get(root.id);
    if (!rootHandle || rootHandle.kind !== 'directory') throw new Error('Browser workspace folder is no longer available.');

    await ensureReadWritePermission(rootHandle);

    const fileName = toExcalidrawFileName(suggestedName);
    const fileHandle = await rootHandle.getFileHandle(fileName, { create: true });
    const path = fileName;
    const id = `${root.id}/${path}` as WorkspaceFileId;
    browserHandles.set(id, fileHandle);
    browserHandlePaths.set(id, path);

    const document: WorkspaceDocument = {
      id,
      providerKind: this.kind,
      rootId: root.id,
      title: fileName,
      path,
      snapshot,
      isUntitled: false,
      isSupported: true,
    };
    await this.writeDocument(document, snapshot);

    return {
      document,
      entry: {
        id,
        rootId: root.id,
        providerKind: this.kind,
        kind: 'file' as const,
        name: fileName,
        path,
        parentId: null,
        extension: extensionFor(fileName),
        isSupported: true,
      },
    };
  }

  private async openRootFromHandle(handle: DirectoryHandle) {
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
