import { createCompoundContext } from '@kit/ui';

export const [LoginCardContext, useLoginCard] = createCompoundContext<{ titleId: string }>(
  'LoginCard'
);
