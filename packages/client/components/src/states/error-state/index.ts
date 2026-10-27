import {
  ErrorStateAction,
  ErrorStateDescription,
  ErrorStateIllustration,
  ErrorStateRetry,
  ErrorStateRoot,
  ErrorStateTitle,
} from './error-state';

export const ErrorState = {
  Root: ErrorStateRoot,
  Illustration: ErrorStateIllustration,
  Title: ErrorStateTitle,
  Description: ErrorStateDescription,
  Action: ErrorStateAction,
  Retry: ErrorStateRetry,
};
export type { ErrorStatePartProps, ErrorStateRootProps } from './error-state';
export { useErrorState } from './error-state.context';
export { errorStateStyles } from './error-state.variants';
export type { ErrorStateKind } from './types';
