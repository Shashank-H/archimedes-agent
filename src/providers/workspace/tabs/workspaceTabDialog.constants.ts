import type { WorkspaceTab } from '../../../lib/workspace/types';

export const WORKSPACE_TAB_DIALOG_COPY = {
  saveUntitledFile: {
    kicker: 'Save diagram',
    title: 'Save untitled diagram',
    description: 'Choose the file name to create inside the currently opened workspace folder.',
    inputLabel: 'File name',
    confirmLabel: 'Save diagram',
    cancelLabel: 'Cancel',
    emptyError: 'Enter a file name to save this diagram.',
    separatorError: 'File names cannot include folder separators.',
  },
  closeDirtyTab: (tab: WorkspaceTab) => ({
    kicker: 'Unsaved changes',
    title: `Close ${tab.title}?`,
    description: 'This tab has unsaved changes. Closing it now will discard those changes.',
    confirmLabel: 'Close without saving',
    cancelLabel: 'Cancel',
  }),
  closeAllTabs: (totalTabCount: number, unsavedTabCount: number, firstUnsavedTab?: WorkspaceTab) => ({
    kicker: 'Unsaved changes',
    title: unsavedTabCount === 1 && firstUnsavedTab
      ? `Close ${firstUnsavedTab.title}?`
      : `Close all ${totalTabCount} tabs?`,
    description: unsavedTabCount === 1
      ? 'This tab has unsaved changes. Closing it now will discard those changes.'
      : `${unsavedTabCount} tabs have unsaved changes. Closing all tabs now will discard those changes.`,
    confirmLabel: unsavedTabCount === 1 ? 'Close without saving' : 'Close all without saving',
    cancelLabel: 'Cancel',
  }),
  clearCanvas: (tab: WorkspaceTab) => ({
    kicker: 'Clear canvas',
    title: `Clear ${tab.title}?`,
    description: 'This will remove every element and file from the active canvas. Other tabs will not be changed.',
    confirmLabel: 'Clear canvas',
    cancelLabel: 'Cancel',
  }),
} as const;
