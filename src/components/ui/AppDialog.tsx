import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import './AppDialog.css';

type AppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
};

export function AppDialog({
  open,
  onOpenChange,
  className = 'app-dialog',
  labelledBy,
  describedBy,
  children,
}: AppDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="app-dialog-backdrop credits-backdrop" />
        <Dialog.Content className={className} aria-labelledby={labelledBy} aria-describedby={describedBy}>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const AppDialogTitle = Dialog.Title;
export const AppDialogDescription = Dialog.Description;
