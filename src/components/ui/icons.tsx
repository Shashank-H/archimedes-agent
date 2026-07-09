import type { ComponentType } from 'react';
import {
  ArchiveIcon,
  CardStackIcon,
  CaretDownIcon,
  CaretRightIcon,
  ChatBubbleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Component1Icon,
  Component2Icon,
  CopyIcon,
  Cross2Icon,
  EyeOpenIcon,
  ExclamationTriangleIcon,
  FileIcon,
  FilePlusIcon,
  FileTextIcon,
  GearIcon,
  GitHubLogoIcon,
  HamburgerMenuIcon,
  InfoCircledIcon,
  LayersIcon,
  LightningBoltIcon,
  Link2Icon,
  MagicWandIcon,
  MixerHorizontalIcon,
  MoonIcon,
  OpenInNewWindowIcon,
  PaperPlaneIcon,
  PauseIcon,
  PersonIcon,
  PlayIcon,
  PlusIcon,
  ReloadIcon,
  SunIcon,
  TrashIcon,
  EnterFullScreenIcon,
  ExitFullScreenIcon,
  DividerHorizontalIcon,
} from '@radix-ui/react-icons';

export type IconName =
  | 'brain'
  | 'settings'
  | 'menu'
  | 'explorer'
  | 'diagram'
  | 'draft'
  | 'recent'
  | 'folder'
  | 'folderOpen'
  | 'file'
  | 'fileText'
  | 'unsupportedFile'
  | 'openExternal'
  | 'refresh'
  | 'plus'
  | 'chevronRight'
  | 'chevronLeft'
  | 'caretRight'
  | 'caretDown'
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
  | 'xSocial'
  | 'linkedin'
  | 'eye'
  | 'copy'
  | 'check'
  | 'chevronDown'
  | 'windowMinimize'
  | 'windowMaximize'
  | 'windowRestore';

type RadixIconProps = { width?: number; height?: number; 'aria-hidden'?: boolean };

function XLogoIcon({ width = 16, height = 16, 'aria-hidden': ariaHidden }: RadixIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden={ariaHidden} xmlns="http://www.w3.org/2000/svg">
      <path d="M13.9 10.47 21.35 2h-1.77l-6.47 7.35L7.95 2H2l7.81 11.12L2 22h1.77l6.82-7.75L16.05 22H22l-8.1-11.53Zm-2.41 2.74-.79-1.11L4.4 3.3h2.7l5.08 7.1.79 1.11 6.61 9.24h-2.7l-5.39-7.54Z" fill="currentColor" />
    </svg>
  );
}

function LinkedInLogoIcon({ width = 16, height = 16, 'aria-hidden': ariaHidden }: RadixIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden={ariaHidden} xmlns="http://www.w3.org/2000/svg">
      <path d="M5.34 8.88H2.67V21h2.67V8.88ZM5.57 5.13C5.55 4.34 4.99 3.73 4.09 3.73c-.9 0-1.49.61-1.49 1.4 0 .77.57 1.4 1.46 1.4h.02c.92 0 1.49-.63 1.49-1.4ZM21.4 14.05c0-3.73-1.99-5.47-4.65-5.47-2.14 0-3.1 1.18-3.64 2.01V8.88h-2.66c.03 1.14 0 12.12 0 12.12h2.66v-6.77c0-.36.03-.72.13-.98.29-.72.94-1.47 2.04-1.47 1.44 0 2.02 1.1 2.02 2.7V21h2.66l.01-.01h1.43v-6.94Z" fill="currentColor" />
    </svg>
  );
}

const RADIX_ICON_BY_NAME: Record<IconName, ComponentType<RadixIconProps>> = {
  brain: Component1Icon,
  settings: GearIcon,
  menu: HamburgerMenuIcon,
  explorer: LayersIcon,
  diagram: Component2Icon,
  draft: FilePlusIcon,
  recent: CardStackIcon,
  folder: ArchiveIcon,
  folderOpen: ArchiveIcon,
  file: FileIcon,
  fileText: FileTextIcon,
  unsupportedFile: ExclamationTriangleIcon,
  openExternal: OpenInNewWindowIcon,
  refresh: ReloadIcon,
  plus: PlusIcon,
  chevronRight: ChevronRightIcon,
  chevronLeft: ChevronLeftIcon,
  caretRight: CaretRightIcon,
  caretDown: CaretDownIcon,
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
  xSocial: XLogoIcon,
  linkedin: LinkedInLogoIcon,
  eye: EyeOpenIcon,
  copy: CopyIcon,
  check: CheckIcon,
  chevronDown: ChevronDownIcon,
  windowMinimize: DividerHorizontalIcon,
  windowMaximize: EnterFullScreenIcon,
  windowRestore: ExitFullScreenIcon,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const RadixIcon = RADIX_ICON_BY_NAME[name];
  return <RadixIcon width={size} height={size} aria-hidden />;
}
