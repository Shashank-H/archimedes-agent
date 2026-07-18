import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type DiagramSnapshot } from '../../../types';
import { AppStorage } from '../../../lib/storage';
import {
  AUTOSAVE_DELAY_MS,
  WorkspaceAutosaveDebouncer,
  WorkspaceSaveInFlightGuard,
  canAutoSaveWorkspaceTab,
  hasUnsafeWorkspaceTabChanges,
} from './WorkspaceTabManagerContext';
import type { WorkspaceFileId, WorkspaceTab } from '../../../lib/workspace/types';

const savedFileTab: WorkspaceTab = {
  id: 'native:///workspace/diagram.excalidraw',
  title: 'diagram.excalidraw',
  path: '/workspace/diagram.excalidraw',
  providerKind: 'native',
  rootId: 'native:///workspace',
  isUntitled: false,
  isSupported: true,
  loadState: 'loaded',
  saveState: 'dirty',
  error: null,
};

const snapshot: DiagramSnapshot = {
  elements: [],
  appState: {},
  files: {},
  updatedAt: 1,
};

describe('file autosave settings', () => {
  it('defaults file autosave off', () => {
    expect(DEFAULT_SETTINGS.autoSaveFiles).toBe(false);
  });

  it('persists file autosave as an explicit boolean app setting', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { matchMedia: undefined, location: { search: '' } });

    const appStorage = new AppStorage();
    appStorage.saveSettings({ ...DEFAULT_SETTINGS, autoSaveFiles: true });

    expect(appStorage.loadSettings().autoSaveFiles).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('hasUnsafeWorkspaceTabChanges', () => {
  it('treats saving tabs as unsafe to close without confirmation', () => {
    expect(hasUnsafeWorkspaceTabChanges({ ...savedFileTab, saveState: 'saving' })).toBe(true);
  });

  it('preserves existing unsafe close detection for dirty and error tabs only', () => {
    expect(hasUnsafeWorkspaceTabChanges({ ...savedFileTab, saveState: 'dirty' })).toBe(true);
    expect(hasUnsafeWorkspaceTabChanges({ ...savedFileTab, saveState: 'error' })).toBe(true);
    expect(hasUnsafeWorkspaceTabChanges({ ...savedFileTab, saveState: 'saved' })).toBe(false);
    expect(hasUnsafeWorkspaceTabChanges({ ...savedFileTab, saveState: 'idle' })).toBe(false);
  });
});

describe('WorkspaceSaveInFlightGuard', () => {
  it('coalesces duplicate saves for the same tab before UI state commits', async () => {
    const guard = new WorkspaceSaveInFlightGuard<string>();
    let writes = 0;
    let finishWrite: () => void = () => undefined;

    const firstSave = guard.run('tab-1', async () => {
      writes += 1;
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
    });
    const duplicateSave = guard.run('tab-1', async () => {
      writes += 1;
    });

    expect(writes).toBe(1);
    finishWrite();
    await Promise.all([firstSave, duplicateSave]);
    expect(writes).toBe(1);
  });

  it('clears the in-flight save after rejection so a later retry can run', async () => {
    const guard = new WorkspaceSaveInFlightGuard<string>();
    let writes = 0;

    await expect(guard.run('tab-1', async () => {
      writes += 1;
      throw new Error('disk full');
    })).rejects.toThrow('disk full');

    await guard.run('tab-1', async () => {
      writes += 1;
    });

    expect(writes).toBe(2);
  });
});

describe('WorkspaceAutosaveDebouncer', () => {
  it('waits for the named autosave delay before saving an eligible tab', () => {
    vi.useFakeTimers();
    const saveTab = vi.fn();
    const debouncer = new WorkspaceAutosaveDebouncer<WorkspaceFileId>(AUTOSAVE_DELAY_MS, saveTab);

    debouncer.sync([{ tab: savedFileTab, snapshot }], true);
    expect(saveTab).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(saveTab).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(saveTab).toHaveBeenCalledTimes(1);
    expect(saveTab).toHaveBeenCalledWith(savedFileTab.id);

    debouncer.dispose();
    vi.useRealTimers();
  });

  it('resets only the edited tab timer while preserving other tab schedules', () => {
    vi.useFakeTimers();
    const saveTab = vi.fn();
    const debouncer = new WorkspaceAutosaveDebouncer<WorkspaceFileId>(AUTOSAVE_DELAY_MS, saveTab);
    const secondTab = { ...savedFileTab, id: 'native:///workspace/second.excalidraw' as typeof savedFileTab.id };

    debouncer.sync([
      { tab: savedFileTab, snapshot },
      { tab: secondTab, snapshot },
    ], true);
    vi.advanceTimersByTime(Math.floor(AUTOSAVE_DELAY_MS / 2));

    debouncer.sync([
      { tab: savedFileTab, snapshot: { ...snapshot, appState: { theme: 'dark' }, updatedAt: 2 } },
      { tab: secondTab, snapshot },
    ], true);
    vi.advanceTimersByTime(Math.ceil(AUTOSAVE_DELAY_MS / 2));

    expect(saveTab).toHaveBeenCalledTimes(1);
    expect(saveTab).toHaveBeenCalledWith(secondTab.id);

    vi.advanceTimersByTime(Math.floor(AUTOSAVE_DELAY_MS / 2));
    expect(saveTab).toHaveBeenCalledTimes(2);
    expect(saveTab).toHaveBeenLastCalledWith(savedFileTab.id);

    debouncer.dispose();
    vi.useRealTimers();
  });

  it('cancels timers without saving when autosave is disabled or tabs stop qualifying', () => {
    vi.useFakeTimers();
    const saveTab = vi.fn();
    const debouncer = new WorkspaceAutosaveDebouncer<WorkspaceFileId>(AUTOSAVE_DELAY_MS, saveTab);

    debouncer.sync([{ tab: savedFileTab, snapshot }], true);
    debouncer.sync([{ tab: savedFileTab, snapshot }], false);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(saveTab).not.toHaveBeenCalled();

    debouncer.sync([{ tab: savedFileTab, snapshot }], true);
    debouncer.sync([{ tab: { ...savedFileTab, saveState: 'saved' }, snapshot }], true);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(saveTab).not.toHaveBeenCalled();

    debouncer.dispose();
    vi.useRealTimers();
  });

  it('schedules a debounced save when an in-flight save settles with newer dirty edits', () => {
    vi.useFakeTimers();
    const saveTab = vi.fn();
    const debouncer = new WorkspaceAutosaveDebouncer<WorkspaceFileId>(AUTOSAVE_DELAY_MS, saveTab);

    debouncer.sync([{ tab: { ...savedFileTab, saveState: 'saving' }, snapshot }], true);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    expect(saveTab).not.toHaveBeenCalled();

    debouncer.sync([{ tab: savedFileTab, snapshot: { ...snapshot, appState: { theme: 'dark' } } }], true);
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(saveTab).toHaveBeenCalledTimes(1);
    expect(saveTab).toHaveBeenCalledWith(savedFileTab.id);

    debouncer.dispose();
    vi.useRealTimers();
  });

  it('cleans up scheduled timers on dispose', () => {
    vi.useFakeTimers();
    const saveTab = vi.fn();
    const debouncer = new WorkspaceAutosaveDebouncer<WorkspaceFileId>(AUTOSAVE_DELAY_MS, saveTab);

    debouncer.sync([{ tab: savedFileTab, snapshot }], true);
    debouncer.dispose();
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);

    expect(saveTab).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('canAutoSaveWorkspaceTab', () => {
  it('allows dirty already-saved workspace files when enabled and a snapshot exists', () => {
    expect(canAutoSaveWorkspaceTab(savedFileTab, snapshot, true)).toBe(true);
  });

  it('does not autosave when disabled, untitled, unsupported, app tabs, saving, or no snapshot', () => {
    expect(canAutoSaveWorkspaceTab(savedFileTab, snapshot, false)).toBe(false);
    expect(canAutoSaveWorkspaceTab({ ...savedFileTab, isUntitled: true }, snapshot, true)).toBe(false);
    expect(canAutoSaveWorkspaceTab({ ...savedFileTab, isSupported: false }, snapshot, true)).toBe(false);
    expect(canAutoSaveWorkspaceTab({ ...savedFileTab, providerKind: 'app' }, snapshot, true)).toBe(false);
    expect(canAutoSaveWorkspaceTab({ ...savedFileTab, saveState: 'saving' }, snapshot, true)).toBe(false);
    expect(canAutoSaveWorkspaceTab(savedFileTab, null, true)).toBe(false);
  });
});
