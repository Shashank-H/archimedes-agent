import type { DiagramSnapshot } from '../../types';

export type WorkspaceProviderKind = 'native' | 'browser' | 'untitled';
export type WorkspaceEntryKind = 'file' | 'directory';
export type WorkspaceFileId = `${WorkspaceProviderKind}://${string}`;
export type WorkspaceRootId = WorkspaceFileId;
export type WorkspaceSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type WorkspaceLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export type WorkspaceCapabilities = {
  canOpenDirectory: boolean;
  canWrite: boolean;
  canRefresh: boolean;
  canWatch: boolean;
};

export type WorkspaceRoot = {
  id: WorkspaceRootId;
  providerKind: WorkspaceProviderKind;
  name: string;
  path: string;
};

export type WorkspaceEntry = {
  id: WorkspaceFileId;
  rootId: WorkspaceRootId;
  providerKind: WorkspaceProviderKind;
  kind: WorkspaceEntryKind;
  name: string;
  path: string;
  parentId: WorkspaceFileId | null;
  extension?: string;
  isSupported: boolean;
};

export type WorkspaceDocument = {
  id: WorkspaceFileId;
  providerKind: WorkspaceProviderKind;
  rootId: WorkspaceRootId | null;
  title: string;
  path: string;
  snapshot: DiagramSnapshot | null;
  isUntitled: boolean;
  isSupported: boolean;
};

export type WorkspaceTab = {
  id: WorkspaceFileId;
  title: string;
  path: string;
  providerKind: WorkspaceProviderKind;
  rootId: WorkspaceRootId | null;
  isUntitled: boolean;
  isSupported: boolean;
  loadState: WorkspaceLoadState;
  saveState: WorkspaceSaveState;
  error: string | null;
  snapshot: DiagramSnapshot | null;
};

export type WorkspaceOpenRootResult = {
  root: WorkspaceRoot;
  children: WorkspaceEntry[];
};

export type WorkspaceDataProvider = {
  kind: WorkspaceProviderKind;
  capabilities: WorkspaceCapabilities;
  openRoot: () => Promise<WorkspaceOpenRootResult>;
  listChildren: (root: WorkspaceRoot, directoryId: WorkspaceFileId) => Promise<WorkspaceEntry[]>;
  readDocument: (entry: WorkspaceEntry) => Promise<WorkspaceDocument>;
  writeDocument: (document: WorkspaceDocument, snapshot: DiagramSnapshot) => Promise<void>;
};

export function getProviderKindFromId(id: string): WorkspaceProviderKind {
  const prefix = id.split('://')[0];
  if (prefix === 'native' || prefix === 'browser' || prefix === 'untitled') return prefix;
  throw new Error(`Unsupported workspace provider ID: ${id}`);
}

export function isSupportedDiagramPath(path: string) {
  const lowerPath = path.toLowerCase();
  return lowerPath.endsWith('.excalidraw') || lowerPath.endsWith('.excalidraw.json');
}
