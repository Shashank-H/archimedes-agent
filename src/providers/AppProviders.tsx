import type { ReactNode } from 'react';
import { ChatProvider } from './chat/ChatProvider';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <ChatProvider>{children}</ChatProvider>
    </WorkspaceProvider>
  );
}
