import type { WorkspaceCapabilities, WorkspaceProviderKind, WorkspaceSaveState } from './types';

export type WorkspaceRuntime = 'native' | 'web';

export type WorkspacePlatformActionId =
  | 'open-folder'
  | 'refresh'
  | 'new-local-draft'
  | 'save'
  | 'review'
  | 'reveal-native'
  | 'copy-path-native';

export type WorkspacePlatformActionDescriptor = {
  id: WorkspacePlatformActionId;
  label: string;
  shortLabel: string;
  ariaLabel: string;
  title: string;
  enabled: boolean;
  visible: boolean;
  nativeOnly?: boolean;
};

export type WorkspacePlatformActionInput = {
  runtime?: WorkspaceRuntime;
  providerKind?: WorkspaceProviderKind | null;
  capabilities?: Partial<WorkspaceCapabilities> | null;
  hasRoot: boolean;
  canSave: boolean;
  saveState?: WorkspaceSaveState | null;
  canReview: boolean;
  isAssistantBusy: boolean;
};

export function getWorkspaceRuntime(): WorkspaceRuntime {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'native' : 'web';
}

export function getWorkspaceRuntimeLabel(runtime: WorkspaceRuntime = getWorkspaceRuntime()) {
  return runtime === 'native' ? 'Native desktop' : 'Web browser';
}

export function getWorkspacePlatformActions({
  runtime = getWorkspaceRuntime(),
  capabilities,
  hasRoot,
  canSave,
  saveState,
  canReview,
  isAssistantBusy,
}: WorkspacePlatformActionInput): WorkspacePlatformActionDescriptor[] {
  const canOpenDirectory = capabilities?.canOpenDirectory ?? true;
  const canRefresh = capabilities?.canRefresh ?? hasRoot;

  return [
    {
      id: 'open-folder',
      label: runtime === 'native' ? 'Open native folder' : 'Open browser folder',
      shortLabel: 'Open',
      ariaLabel: runtime === 'native' ? 'Open a workspace folder with the native dialog' : 'Open a browser workspace folder',
      title: runtime === 'native' ? 'Open folder' : 'Open browser folder',
      enabled: canOpenDirectory,
      visible: true,
    },
    {
      id: 'refresh',
      label: 'Refresh workspace',
      shortLabel: 'Refresh',
      ariaLabel: 'Refresh workspace explorer',
      title: 'Refresh explorer',
      enabled: Boolean(hasRoot && canRefresh),
      visible: true,
    },
    {
      id: 'new-local-draft',
      label: 'New untitled diagram',
      shortLabel: 'Untitled',
      ariaLabel: 'Create a new untitled diagram',
      title: 'New untitled diagram',
      enabled: true,
      visible: true,
    },
    {
      id: 'save',
      label: saveState === 'saving' ? 'Saving…' : 'Save diagram',
      shortLabel: saveState === 'saving' ? 'Saving' : 'Save',
      ariaLabel: 'Save active diagram',
      title: 'Save active diagram (Ctrl+S)',
      enabled: canSave,
      visible: true,
    },
    {
      id: 'review',
      label: isAssistantBusy ? 'Assistant busy' : 'Review diagram',
      shortLabel: isAssistantBusy ? 'Busy' : 'Review',
      ariaLabel: 'Ask Archimedes to review the active diagram',
      title: 'Review current diagram',
      enabled: canReview && !isAssistantBusy,
      visible: true,
    },
    {
      id: 'reveal-native',
      label: 'Reveal in file manager',
      shortLabel: 'Reveal',
      ariaLabel: 'Reveal active file in the system file manager',
      title: 'Reveal in file manager (native only, planned)',
      enabled: false,
      visible: runtime === 'native',
      nativeOnly: true,
    },
    {
      id: 'copy-path-native',
      label: 'Copy absolute path',
      shortLabel: 'Path',
      ariaLabel: 'Copy the active native file path',
      title: 'Copy absolute path (native only, planned)',
      enabled: false,
      visible: runtime === 'native',
      nativeOnly: true,
    },
  ];
}
