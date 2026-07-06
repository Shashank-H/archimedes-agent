import { invoke } from '@tauri-apps/api/core';
import { parseExcalidrawFile, serializeExcalidrawFile } from '../excalidrawFile';
import type { DiagramSnapshot } from '../../types';
import type {
  NativeOpenWorkspacePathResult,
  WorkspaceDataProvider,
  WorkspaceDocument,
  WorkspaceEntry,
  WorkspaceOpenRootResult,
  WorkspaceRoot,
} from './types';
import { isSupportedDiagramPath } from './types';

type NativeWorkspaceEntryDto = {
  id: string;
  root_id: string | null;
  kind: 'file' | 'directory';
  name: string;
  path: string;
  parent_id: string | null;
  extension?: string | null;
  is_supported: boolean;
};

type NativeWorkspaceRootDto = {
  id: string;
  provider_kind: 'native';
  name: string;
  path: string;
};

type NativeOpenRootDto = {
  root: NativeWorkspaceRootDto;
  children: NativeWorkspaceEntryDto[];
};

type NativeOpenPathDto = {
  status: 'opened' | 'invalid' | 'unsupported';
  kind: 'file' | 'directory' | null;
  path: string;
  root: NativeOpenRootDto | null;
  target_entry: NativeWorkspaceEntryDto | null;
  message: string | null;
};

function toRoot(dto: NativeWorkspaceRootDto): WorkspaceRoot {
  return { id: dto.id as WorkspaceRoot['id'], providerKind: 'native', name: dto.name, path: dto.path };
}

function toEntry(dto: NativeWorkspaceEntryDto): WorkspaceEntry {
  return {
    id: dto.id as WorkspaceEntry['id'],
    rootId: dto.root_id as WorkspaceEntry['rootId'],
    providerKind: 'native',
    kind: dto.kind,
    name: dto.name,
    path: dto.path,
    parentId: dto.parent_id as WorkspaceEntry['parentId'],
    extension: dto.extension ?? undefined,
    isSupported: dto.is_supported,
  };
}

function toOpenRootResult(dto: NativeOpenRootDto): WorkspaceOpenRootResult {
  return { root: toRoot(dto.root), children: dto.children.map(toEntry) };
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

function withExcalidrawExtension(path: string) {
  return isSupportedDiagramPath(path) ? path : `${path}.excalidraw`;
}

function basename(path: string) {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
}

export class NativeWorkspaceProvider implements WorkspaceDataProvider {
  readonly kind = 'native' as const;
  readonly capabilities = {
    canOpenDirectory: true,
    canWrite: true,
    canRefresh: true,
    canWatch: false,
  };

  async openRoot(): Promise<WorkspaceOpenRootResult> {
    let result = await invoke<NativeOpenRootDto | null>('open_workspace_root');

    if (!result) {
      const rootPath = window.prompt('Enter the absolute folder path to open as a workspace:');
      if (!rootPath) throw new Error('No folder selected.');
      return this.openRootAt(rootPath);
    }

    return toOpenRootResult(result);
  }

  async restoreRoot(root: WorkspaceRoot): Promise<WorkspaceOpenRootResult> {
    return this.openRootAt(root.path);
  }

  async openRootAt(rootPath: string): Promise<WorkspaceOpenRootResult> {
    const result = await invoke<NativeOpenRootDto | null>('open_workspace_root_at', { rootPath });
    if (!result) throw new Error('Could not open workspace folder.');
    return toOpenRootResult(result);
  }

  async openRootInNewWindow(): Promise<void> {
    const rootPath = window.prompt('Enter the absolute folder path to open in a new window:');
    if (!rootPath) throw new DOMException('Open cancelled.', 'AbortError');
    await invoke('open_workspace_path_in_new_window', { requestedPath: rootPath });
  }

  async openPath(path: string): Promise<NativeOpenWorkspacePathResult> {
    const result = await invoke<NativeOpenPathDto>('open_workspace_path', { requestedPath: path });

    if (result.status !== 'opened') {
      return {
        status: result.status,
        kind: result.kind ?? undefined,
        path: result.path,
        root: null,
        children: [],
        targetEntry: null,
        message: result.message ?? 'Could not open the requested path.',
      };
    }

    const rootResult = result.root ? toOpenRootResult(result.root) : { root: null, children: [] };
    return {
      status: 'opened',
      kind: result.kind ?? undefined,
      path: result.path,
      ...rootResult,
      targetEntry: result.target_entry ? toEntry(result.target_entry) : null,
      message: result.message ?? undefined,
    };
  }

  async takeNativeOpenRequests(): Promise<string[]> {
    return invoke<string[]>('take_native_open_requests');
  }

  async registerWindowWorkspaceRoot(rootPath: string | null): Promise<void> {
    await invoke('register_window_workspace_root', { rootPath });
  }

  async listChildren(root: WorkspaceRoot, directoryId: WorkspaceEntry['id']): Promise<WorkspaceEntry[]> {
    const result = await invoke<NativeWorkspaceEntryDto[]>('list_workspace_children', {
      rootId: root.id,
      directoryId,
    });
    return result.map(toEntry);
  }

  async readDocument(entry: WorkspaceEntry): Promise<WorkspaceDocument> {
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

    const content = await invoke<string>('read_workspace_file', { fileId: entry.id, rootId: entry.rootId });
    return {
      id: entry.id,
      providerKind: this.kind,
      rootId: entry.rootId,
      title: entry.name,
      path: entry.path,
      snapshot: parseExcalidrawFile(content),
      isUntitled: false,
      isSupported: true,
    };
  }

  async writeDocument(document: WorkspaceDocument, snapshot: DiagramSnapshot): Promise<void> {
    await invoke('write_workspace_file', {
      fileId: document.id,
      rootId: document.rootId,
      content: serializeExcalidrawFile(snapshot),
    });
  }

  async createFileDocument(suggestedName: string, snapshot: DiagramSnapshot) {
    const suggestedPath = withExcalidrawExtension(suggestedName.trim() || 'local-draft');
    const selectedPath = window.prompt('Save this diagram as an absolute file path:', suggestedPath);
    if (!selectedPath) throw new DOMException('Save cancelled.', 'AbortError');

    const path = withExcalidrawExtension(selectedPath);
    const title = basename(path);
    const id = `native://${path}` as WorkspaceEntry['id'];
    const document: WorkspaceDocument = {
      id,
      providerKind: this.kind,
      rootId: null,
      title,
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
        rootId: null,
        providerKind: this.kind,
        kind: 'file' as const,
        name: title,
        path,
        parentId: null,
        extension: extensionFor(title),
        isSupported: true,
      },
    };
  }

  async createDocument(root: WorkspaceRoot, suggestedName: string, snapshot: DiagramSnapshot) {
    const fileName = toExcalidrawFileName(suggestedName);
    const path = `${root.path}/${fileName}`;
    const id = `native://${path}` as WorkspaceEntry['id'];
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
}

export const nativeWorkspaceProvider = new NativeWorkspaceProvider();
