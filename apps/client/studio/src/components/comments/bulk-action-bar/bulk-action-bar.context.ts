import { createCompoundContext } from '@vp/ui';

export const [BulkActionBarContext, useBulkActionBar] = createCompoundContext<{
  pending: boolean;
}>('BulkActionBar');
