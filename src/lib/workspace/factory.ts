import { browserWorkspaceProvider } from './browser';
import { nativeWorkspaceProvider } from './native';
import { untitledWorkspaceProvider } from './untitled';
import { getProviderKindFromId, type WorkspaceDataProvider, type WorkspaceProviderKind } from './types';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class WorkspaceProviderFactory {
  private readonly providers: Record<WorkspaceProviderKind, WorkspaceDataProvider> = {
    native: nativeWorkspaceProvider,
    browser: browserWorkspaceProvider,
    untitled: untitledWorkspaceProvider,
  };

  getProvider(kind: WorkspaceProviderKind) {
    return this.providers[kind];
  }

  getProviderForId(id: string) {
    return this.getProvider(getProviderKindFromId(id));
  }

  getDefaultProvider() {
    return isTauriRuntime() ? this.providers.native : this.providers.browser;
  }

  getUntitledProvider() {
    return this.providers.untitled;
  }
}

export const workspaceProviderFactory = new WorkspaceProviderFactory();
