import {
  ErrorStateAction,
  ErrorStateDescription,
  ErrorStateDetails,
  ErrorStateIllustration,
  ErrorStateReference,
  ErrorStateRetry,
  ErrorStateRoot,
  ErrorStateTitle,
} from './error-state';

export const ErrorState = {
  Root: ErrorStateRoot,
  Illustration: ErrorStateIllustration,
  Title: ErrorStateTitle,
  Description: ErrorStateDescription,
  Details: ErrorStateDetails,
  Action: ErrorStateAction,
  Reference: ErrorStateReference,
  Retry: ErrorStateRetry,
};
export type {
  ErrorStatePartProps,
  ErrorStateReferenceProps,
  ErrorStateRootProps,
} from './error-state';
export { useErrorState } from './error-state.context';
export { errorStateStyles } from './error-state.variants';
export type { ErrorStateKind } from './types';
