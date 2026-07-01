import type { KeyboardEventHandler, PointerEventHandler } from 'react';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from '../constants';

type SidebarResizerProps = {
  sidebarWidth: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

export function SidebarResizer({ sidebarWidth, onPointerDown, onKeyDown }: SidebarResizerProps) {
  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-label="Resize assistant sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={sidebarWidth}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
