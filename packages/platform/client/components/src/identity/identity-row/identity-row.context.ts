import { createCompoundContext } from '@kit/ui';

export const [IdentityRowContext, useIdentityRow] = createCompoundContext<{
  current: boolean;
  expired: boolean;
}>('IdentityRow');
