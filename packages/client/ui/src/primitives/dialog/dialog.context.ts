import { createCompoundContext } from '../../lib/create-compound-context';
import type { DialogSide, DialogSize } from './types';

export const [DialogContext, useDialog] = createCompoundContext<{
  side: DialogSide | undefined;
  size: DialogSize;
}>('Dialog');
