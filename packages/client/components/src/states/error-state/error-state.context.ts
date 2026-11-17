import { createCompoundContext } from '@kit/ui';
import type { ErrorStateKind } from './types';

export const [ErrorStateContext, useErrorState] = createCompoundContext<{
  kind: ErrorStateKind;
  onRetry: (() => void) | undefined;
  retrying: boolean;
}>('ErrorState');
