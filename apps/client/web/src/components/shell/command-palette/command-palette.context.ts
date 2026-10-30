import { createCompoundContext } from '@vp/ui';
import type { CommandPaletteVariant } from './types';

export const [CommandPaletteContext, useCommandPalette] = createCompoundContext<{
  variant: CommandPaletteVariant;
  open: boolean;
  query: string;
  setQuery: (query: string) => void;
  submit: (query: string) => void;
  close: () => void;
}>('CommandPalette');
