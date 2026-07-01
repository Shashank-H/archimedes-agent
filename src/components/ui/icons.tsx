import type { ComponentType } from 'react';
import {
  ChatBubbleIcon,
  CheckIcon,
  ChevronDownIcon,
  Component1Icon,
  CopyIcon,
  Cross2Icon,
  EyeOpenIcon,
  GearIcon,
  GitHubLogoIcon,
  InfoCircledIcon,
  LightningBoltIcon,
  Link2Icon,
  MagicWandIcon,
  MixerHorizontalIcon,
  MoonIcon,
  PaperPlaneIcon,
  PauseIcon,
  PersonIcon,
  PlayIcon,
  SunIcon,
  TrashIcon,
} from '@radix-ui/react-icons';

export type IconName =
  | 'brain'
  | 'settings'
  | 'message'
  | 'plug'
  | 'moon'
  | 'sun'
  | 'zap'
  | 'sparkles'
  | 'play'
  | 'pause'
  | 'send'
  | 'trash'
  | 'user'
  | 'sliders'
  | 'info'
  | 'x'
  | 'github'
  | 'eye'
  | 'copy'
  | 'check'
  | 'chevronDown';

type RadixIconProps = { width?: number; height?: number; 'aria-hidden'?: boolean };

const RADIX_ICON_BY_NAME: Record<IconName, ComponentType<RadixIconProps>> = {
  brain: Component1Icon,
  settings: GearIcon,
  message: ChatBubbleIcon,
  plug: Link2Icon,
  moon: MoonIcon,
  sun: SunIcon,
  zap: LightningBoltIcon,
  sparkles: MagicWandIcon,
  play: PlayIcon,
  pause: PauseIcon,
  send: PaperPlaneIcon,
  trash: TrashIcon,
  user: PersonIcon,
  sliders: MixerHorizontalIcon,
  info: InfoCircledIcon,
  x: Cross2Icon,
  github: GitHubLogoIcon,
  eye: EyeOpenIcon,
  copy: CopyIcon,
  check: CheckIcon,
  chevronDown: ChevronDownIcon,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const RadixIcon = RADIX_ICON_BY_NAME[name];
  return <RadixIcon width={size} height={size} aria-hidden />;
}
