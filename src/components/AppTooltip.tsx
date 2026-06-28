import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

type AppTooltipProps = {
  label: string;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
};

export function AppTooltip({ label, children, side = 'top', align = 'center' }: AppTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={250} skipDelayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="app-tooltip" side={side} align={align} sideOffset={8} collisionPadding={12}>
            {label as ReactNode}
            <Tooltip.Arrow className="app-tooltip-arrow" width={8} height={4} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
