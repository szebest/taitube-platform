import { EmptyState } from '@kit/components';
import { AccessGatePasswordForm, AccessGateRoot, AccessGateTitle } from './access-gate';

export const AccessGate = {
  Root: AccessGateRoot,
  Title: AccessGateTitle,
  Description: EmptyState.Description,
  PasswordForm: AccessGatePasswordForm,
  Action: EmptyState.Action,
};

export type { AccessGatePasswordFormProps } from './access-gate';
