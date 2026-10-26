import { createCompoundContext } from '@vp/ui';

export const [LoginCardContext, useLoginCard] = createCompoundContext<{ titleId: string }>(
  'LoginCard'
);
