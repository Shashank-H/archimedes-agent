import { invoke } from '@tauri-apps/api/core';
import { parseExcalidrawFile, serializeExcalidrawFile } from '../excalidrawFile';
import type { DiagramSnapshot } from '../../types';
import type {
  WorkspaceDataProvider,
  WorkspaceDocument,
  WorkspaceEntry,
  WorkspaceOpenRootResult,
  WorkspaceRoot,
} from './types';
import { isSupportedDiagramPath } from './types';

type NativeWorkspaceEntryDto = {
  id: string;
  root_id: string;
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
      result = await invoke<NativeOpenRootDto | null>('open_workspace_root_at', { rootPath });
    }

    if (!result) throw new Error('No folder selected.');
    return { root: toRoot(result.root), children: result.children.map(toEntry) };
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
    if (!document.rootId) throw new Error('Cannot save a native document without a workspace root.');
    await invoke('write_workspace_file', {
      fileId: document.id,
      rootId: document.rootId,
      content: serializeExcalidrawFile(snapshot),
    });
  }
}

export const nativeWorkspaceProvider = new NativeWorkspaceProvider();
