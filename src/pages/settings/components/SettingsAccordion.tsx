import type { ReactNode } from 'react';
import { Icon } from '../../../components/ui/icons';

type SettingsAccordionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary: string;
  children: ReactNode;
  onClosing?: () => void;
};

export function SettingsAccordion({ open, onOpenChange, title, summary, children, onClosing }: SettingsAccordionProps) {
  return (
    <div className="provider-config-accordion" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="provider-config-summary"
        onClick={() => {
          if (open) onClosing?.();
          onOpenChange(!open);
        }}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <Icon name="chevronDown" size={15} />
      </button>
      {open && <div className="provider-config-content">{children}</div>}
    </div>
  );
}
