import { createCompoundContext } from '@vp/ui';

export const [SecretRevealContext, useSecretReveal] = createCompoundContext<{
  value: string;
  labelId: string;
  copied: boolean;
  markCopied: () => void;
  acknowledged: boolean;
  acknowledge: (saved: boolean) => void;
}>('SecretReveal');
