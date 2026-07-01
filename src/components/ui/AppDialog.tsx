import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

type AppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  labelledBy: string;
  children: ReactNode;
};

export function AppDialog({ open, onOpenChange, className = 'credits-modal', labelledBy, children }: AppDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="credits-backdrop" />
        <Dialog.Content className={className} aria-labelledby={labelledBy}>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const AppDialogTitle = Dialog.Title;
