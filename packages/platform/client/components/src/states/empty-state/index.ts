import {
  EmptyStateAction,
  EmptyStateDescription,
  EmptyStateIllustration,
  EmptyStateRoot,
  EmptyStateSecondary,
  EmptyStateTitle,
} from './empty-state';

export const EmptyState = {
  Root: EmptyStateRoot,
  Illustration: EmptyStateIllustration,
  Title: EmptyStateTitle,
  Description: EmptyStateDescription,
  Action: EmptyStateAction,
  Secondary: EmptyStateSecondary,
};
export type {
  EmptyStatePartProps,
  EmptyStateRootProps,
  EmptyStateSecondaryProps,
} from './empty-state';
export { useEmptyState } from './empty-state.context';
export { emptyStateStyles } from './empty-state.variants';
export type { EmptyStateSize, EmptyStateTitleStyle } from './types';
