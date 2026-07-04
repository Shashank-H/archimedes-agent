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
  | 'eye'
  | 'copy'
  | 'check'
  | 'chevronDown';

type RadixIconProps = { width?: number; height?: number; 'aria-hidden'?: boolean };

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
  eye: EyeOpenIcon,
  copy: CopyIcon,
  check: CheckIcon,
  chevronDown: ChevronDownIcon,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const RadixIcon = RADIX_ICON_BY_NAME[name];
  return <RadixIcon width={size} height={size} aria-hidden />;
}
