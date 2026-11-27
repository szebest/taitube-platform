import { createCompoundContext } from '@kit/ui';

export const [BulkActionBarContext, useBulkActionBar] = createCompoundContext<{
  pending: boolean;
}>('BulkActionBar');
