import { appStorage } from '../storage';
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

export class UntitledWorkspaceProvider implements WorkspaceDataProvider {
  readonly kind = 'untitled' as const;
  readonly capabilities = {
    canOpenDirectory: false,
    canWrite: true,
    canRefresh: false,
    canWatch: false,
  };

  async openRoot(): Promise<WorkspaceOpenRootResult> {
    return { root: this.getRoot(), children: [this.getEntry()] };
  }

  async listChildren(): Promise<WorkspaceEntry[]> {
    return [this.getEntry()];
  }

  async readDocument(): Promise<WorkspaceDocument> {
    return {
      id: UNTITLED_DOCUMENT_ID,
      providerKind: this.kind,
      rootId: UNTITLED_ROOT_ID,
      title: 'Untitled',
      path: 'Untitled',
      snapshot: appStorage.loadScene(),
      isUntitled: true,
      isSupported: true,
    };
  }

  async writeDocument(_document: WorkspaceDocument, snapshot: DiagramSnapshot): Promise<void> {
    appStorage.saveScene(snapshot);
  }

  getRoot(): WorkspaceRoot {
    return {
      id: UNTITLED_ROOT_ID,
      providerKind: this.kind,
      name: 'Local diagrams',
      path: 'Local diagrams',
    };
  }

  getEntry(): WorkspaceEntry {
    return {
      id: UNTITLED_DOCUMENT_ID,
      rootId: UNTITLED_ROOT_ID,
      providerKind: this.kind,
      kind: 'file',
      name: 'Untitled',
      path: 'Untitled',
      parentId: null,
      extension: '.excalidraw',
      isSupported: true,
    };
  }
}

export const untitledWorkspaceProvider = new UntitledWorkspaceProvider();
