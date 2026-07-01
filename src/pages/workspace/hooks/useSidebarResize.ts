import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react';
import { appStorage } from '../../../lib/storage';
import { DEFAULT_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_CANVAS_WIDTH, MIN_SIDEBAR_WIDTH } from '../constants';

export function clampSidebarWidth(width: number) {
  const viewportLimit = typeof window === 'undefined' ? MAX_SIDEBAR_WIDTH : Math.max(MIN_SIDEBAR_WIDTH, window.innerWidth - MIN_CANVAS_WIDTH);
  return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), Math.min(MAX_SIDEBAR_WIDTH, viewportLimit));
}

function loadSidebarWidth() {
  return clampSidebarWidth(appStorage.loadSidebarWidth(DEFAULT_SIDEBAR_WIDTH));
}

export function useSidebarResize() {
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);

  useEffect(() => {
    const nextWidth = clampSidebarWidth(sidebarWidth);
    if (nextWidth !== sidebarWidth) {
      setSidebarWidth(nextWidth);
      return;
    }
    appStorage.saveSidebarWidth(nextWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    const handleWindowResize = () => setSidebarWidth((width) => clampSidebarWidth(width));
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const resizeSidebarFromClientX = (clientX: number) => {
    setSidebarWidth(clampSidebarWidth(window.innerWidth - clientX));
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeSidebarFromClientX(event.clientX);
    document.body.classList.add('is-resizing-sidebar');

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      resizeSidebarFromClientX(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  };

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth((width) => clampSidebarWidth(width + 24));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((width) => clampSidebarWidth(width - 24));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSidebarWidth(MIN_SIDEBAR_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(MAX_SIDEBAR_WIDTH);
    }
  };

  return { sidebarWidth, handleResizePointerDown, handleResizeKeyDown };
}
