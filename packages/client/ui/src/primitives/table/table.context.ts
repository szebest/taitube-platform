import { createCompoundContext } from '../../lib/create-compound-context';
import type { TableSize } from './types';

export const [TableContext, useTable] = createCompoundContext<{
  size: TableSize;
  stickyHeader: boolean;
}>('Table');
