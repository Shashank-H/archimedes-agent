import type { ReactNode } from 'react';
import { AppTooltip } from './AppTooltip';

type TooltipIconActionProps = {
  label: string;
  children: ReactNode;
  className?: string;
} & (
  | {
      href: string;
      onClick?: never;
      type?: never;
      target?: string;
      rel?: string;
    }
  | {
      href?: never;
      onClick: () => void;
      type?: 'button';
      target?: never;
      rel?: never;
    }
);

export function TooltipIconAction({ label, children, className = '', ...props }: TooltipIconActionProps) {
  const actionClassNames = ['tooltip-icon-action', className].filter(Boolean).join(' ');

  const trigger =
    'href' in props ? (
      <a className={actionClassNames} href={props.href} target={props.target} rel={props.rel} aria-label={label}>
        {children}
      </a>
    ) : (
      <button type={props.type ?? 'button'} className={actionClassNames} onClick={props.onClick} aria-label={label}>
        {children}
      </button>
    );

  return <AppTooltip label={label}>{trigger}</AppTooltip>;
}
