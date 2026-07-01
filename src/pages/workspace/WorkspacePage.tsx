import type { ReactNode } from 'react';
import { WorkspaceShell } from './components/WorkspaceShell';

export function WorkspacePage({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
