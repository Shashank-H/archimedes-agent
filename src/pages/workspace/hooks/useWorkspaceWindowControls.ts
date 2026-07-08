import { useCallback, useEffect, useMemo, useState } from 'react';
import { WORKSPACE_NATIVE_CONTROL_PLATFORMS, WORKSPACE_WINDOW_CONTROL_LABELS } from '../constants';
import { getWorkspaceRuntime } from '../../../lib/workspace/platformActions';
import { detectWorkspaceClientPlatform, type WorkspaceClientPlatform } from '../utils';

type TauriWindowModule = typeof import('@tauri-apps/api/window');
type WorkspaceNativeWindow = ReturnType<TauriWindowModule['getCurrentWindow']>;

type WorkspaceWindowControl = {
  id: 'minimize' | 'maximize' | 'close';
  label: string;
  icon: 'windowMinimize' | 'windowMaximize' | 'windowRestore' | 'x';
  isDestructive?: boolean;
  onClick: () => void;
};

type UseWorkspaceWindowControlsResult = {
  controls: WorkspaceWindowControl[];
  isVisible: boolean;
  isMaximized: boolean;
  platform: WorkspaceClientPlatform;
};

function supportsThemedWindowControls(platform: WorkspaceClientPlatform) {
  return WORKSPACE_NATIVE_CONTROL_PLATFORMS.includes(platform as (typeof WORKSPACE_NATIVE_CONTROL_PLATFORMS)[number]);
}

async function getCurrentNativeWindow(): Promise<WorkspaceNativeWindow | null> {
  if (getWorkspaceRuntime() !== 'native') return null;

  try {
    const windowModule: TauriWindowModule = await import('@tauri-apps/api/window');
    return windowModule.getCurrentWindow();
  } catch (error) {
    console.warn('Native window controls are unavailable in this runtime.', error);
    return null;
  }
}

export function useWorkspaceWindowControls(): UseWorkspaceWindowControlsResult {
  const [nativeWindow, setNativeWindow] = useState<WorkspaceNativeWindow | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const platform = useMemo(() => detectWorkspaceClientPlatform(), []);
  const isVisible = getWorkspaceRuntime() === 'native' && supportsThemedWindowControls(platform);

  const refreshMaximizedState = useCallback(async (windowRef: WorkspaceNativeWindow | null) => {
    if (!windowRef) {
      setIsMaximized(false);
      return;
    }

    try {
      setIsMaximized(await windowRef.isMaximized());
    } catch (error) {
      console.warn('Could not read native window maximized state.', error);
      setIsMaximized(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!isVisible) {
      setNativeWindow(null);
      setIsMaximized(false);
      return undefined;
    }

    void getCurrentNativeWindow().then((windowRef) => {
      if (!isMounted) return;
      setNativeWindow(windowRef);
      void refreshMaximizedState(windowRef);
    });

    return () => {
      isMounted = false;
    };
  }, [isVisible, refreshMaximizedState]);

  useEffect(() => {
    if (!nativeWindow || !isVisible) return undefined;

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    void nativeWindow.onResized(() => {
      if (isMounted) void refreshMaximizedState(nativeWindow);
    }).then((unlisten) => {
      cleanup = unlisten;
    }).catch((error) => {
      console.warn('Could not subscribe to native window resize events.', error);
    });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [isVisible, nativeWindow, refreshMaximizedState]);

  const minimize = useCallback(() => {
    void nativeWindow?.minimize().catch((error) => console.warn('Could not minimize native window.', error));
  }, [nativeWindow]);

  const toggleMaximize = useCallback(() => {
    if (!nativeWindow) return;

    void nativeWindow.toggleMaximize()
      .then(() => refreshMaximizedState(nativeWindow))
      .catch((error) => console.warn('Could not toggle native window maximized state.', error));
  }, [nativeWindow, refreshMaximizedState]);

  const close = useCallback(() => {
    void nativeWindow?.close().catch((error) => console.warn('Could not close native window.', error));
  }, [nativeWindow]);

  const controls = useMemo<WorkspaceWindowControl[]>(() => {
    if (!isVisible || !nativeWindow) return [];

    return [
      {
        id: 'minimize',
        label: WORKSPACE_WINDOW_CONTROL_LABELS.minimize,
        icon: 'windowMinimize',
        onClick: minimize,
      },
      {
        id: 'maximize',
        label: isMaximized ? WORKSPACE_WINDOW_CONTROL_LABELS.restore : WORKSPACE_WINDOW_CONTROL_LABELS.maximize,
        icon: isMaximized ? 'windowRestore' : 'windowMaximize',
        onClick: toggleMaximize,
      },
      {
        id: 'close',
        label: WORKSPACE_WINDOW_CONTROL_LABELS.close,
        icon: 'x',
        isDestructive: true,
        onClick: close,
      },
    ];
  }, [close, isMaximized, isVisible, minimize, nativeWindow, toggleMaximize]);

  return { controls, isVisible, isMaximized, platform };
}
