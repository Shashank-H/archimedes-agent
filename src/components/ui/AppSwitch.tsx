import * as Switch from '@radix-ui/react-switch';

type AppSwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
};

export function AppSwitch({ checked, onCheckedChange, ariaLabel }: AppSwitchProps) {
  return (
    <Switch.Root
      className="settings-switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
    >
      <Switch.Thumb className="settings-switch-thumb" />
    </Switch.Root>
  );
}
