import { serializeExcalidrawFile } from '../excalidrawFile';
import { appStorage, type LocalDraftRecord } from '../storage';
import type { DiagramSnapshot } from '../../types';
import type {
  WorkspaceDataProvider,
  WorkspaceDocument,
  WorkspaceEntry,
  WorkspaceOpenRootResult,
  WorkspaceRoot,
} from './types';

const UNTITLED_ROOT_ID = 'untitled://local/root' as const;
export const UNTITLED_DOCUMENT_ID = 'untitled://local/default' as const;

function getDraftTitle(index: number) {
  return `Local draft ${index}`;
}

function toExcalidrawFileName(title: string) {
  const cleanTitle = title.trim().replace(/[^a-z0-9-_ .]/gi, '-').replace(/-+/g, '-');
  const baseName = cleanTitle || 'local-draft';
  return baseName.toLowerCase().endsWith('.excalidraw') ? baseName : `${baseName}.excalidraw`;
}

type WindowWithSaveFilePicker = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

async function saveSnapshotToUserFile(title: string, snapshot: DiagramSnapshot) {
  const content = serializeExcalidrawFile(snapshot);
  const suggestedName = toExcalidrawFileName(title);
  const savePicker = (window as WindowWithSaveFilePicker).showSaveFilePicker;

  if (savePicker) {
    const handle = await savePicker({
      suggestedName,
      types: [
        {
          description: 'Excalidraw files',
          accept: { 'application/json': ['.excalidraw', '.excalidraw.json'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return;
  }

  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
}

export function createLocalDraftRecord(snapshot: DiagramSnapshot | null = null): LocalDraftRecord {
  const id = `untitled://local/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const draftCount = appStorage.loadLocalDrafts().length + 1;
  const title = getDraftTitle(draftCount);

  return {
    id,
    title,
    path: `Browser local storage/${id.replace('untitled://local/', '')}`,
    snapshot,
    updatedAt: Date.now(),
  };
}

export class UntitledWorkspaceProvider implements WorkspaceDataProvider {
  readonly kind = 'untitled' as const;
  readonly capabilities = {
    canOpenDirectory: false,
    canWrite: true,
    canRefresh: false,
    canWatch: false,
  };

  async openRoot(): Promise<WorkspaceOpenRootResult> {
    return { root: this.getRoot(), children: this.getEntries() };
  }

  async listChildren(): Promise<WorkspaceEntry[]> {
    return this.getEntries();
  }

  async readDocument(entry: WorkspaceEntry): Promise<WorkspaceDocument> {
    const draft = appStorage.loadLocalDraft(entry.id) ?? createLocalDraftRecord(null);
    return {
      id: draft.id as WorkspaceDocument['id'],
      providerKind: this.kind,
      rootId: UNTITLED_ROOT_ID,
      title: draft.title,
      path: draft.path,
      snapshot: draft.snapshot,
      isUntitled: true,
      isSupported: true,
    };
  }

  async writeDocument(document: WorkspaceDocument, snapshot: DiagramSnapshot): Promise<void> {
    await saveSnapshotToUserFile(document.title, snapshot);
    appStorage.saveLocalDraft({
      id: document.id,
      title: document.title,
      path: document.path,
      snapshot,
      updatedAt: Date.now(),
    });
  }

  getRoot(): WorkspaceRoot {
    return {
      id: UNTITLED_ROOT_ID,
      providerKind: this.kind,
      name: 'Local diagrams',
      path: 'Local diagrams',
    };
  }

  getEntries(): WorkspaceEntry[] {
    return appStorage.loadLocalDrafts().map((draft) => ({
      id: draft.id as WorkspaceEntry['id'],
      rootId: UNTITLED_ROOT_ID,
      providerKind: this.kind,
      kind: 'file',
      name: draft.title,
      path: draft.path,
      parentId: null,
      extension: '.excalidraw',
      isSupported: true,
    }));
  }
}

export const untitledWorkspaceProvider = new UntitledWorkspaceProvider();
