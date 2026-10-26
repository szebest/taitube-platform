import { createCompoundContext } from '../../lib/create-compound-context';
import type { CommandSize, CommandVariant } from './types';

export const [CommandContext, useCommand] = createCompoundContext<{
  variant: CommandVariant;
  size: CommandSize;
}>('Command');
