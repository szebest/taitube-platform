import { createCompoundContext } from '@vp/ui';

export const [CredentialFieldContext, useCredentialField] = createCompoundContext<{
  secret: boolean;
  revealed: boolean;
  toggle: () => void;
  labelId: string;
}>('CredentialField');
