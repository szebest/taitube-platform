import {
  CommandPaletteEmpty,
  CommandPaletteFooter,
  CommandPaletteGroup,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
  CommandPaletteLoading,
  CommandPaletteNotice,
  CommandPaletteOffline,
  CommandPaletteRoot,
  CommandPaletteStatus,
} from './command-palette';

export const CommandPalette = {
  Root: CommandPaletteRoot,
  Input: CommandPaletteInput,
  Loading: CommandPaletteLoading,
  Notice: CommandPaletteNotice,
  Offline: CommandPaletteOffline,
  List: CommandPaletteList,
  Group: CommandPaletteGroup,
  Item: CommandPaletteItem,
  Empty: CommandPaletteEmpty,
  Status: CommandPaletteStatus,
  Footer: CommandPaletteFooter,
};

export { CommandPaletteSkeleton, keepEnterFromTheList } from './command-palette';

export { useCommandPalette } from './command-palette.context';
export { commandPaletteStyles } from './command-palette.variants';
