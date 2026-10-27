import { createCompoundContext } from '@vp/ui';
import type { EmptyStateSize, EmptyStateTitleStyle } from './types';

export const [EmptyStateContext, useEmptyState] = createCompoundContext<{
  size: EmptyStateSize;
  titleStyle: EmptyStateTitleStyle;
}>('EmptyState');
