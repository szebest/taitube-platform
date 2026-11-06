import {
  CredentialFieldCopy,
  CredentialFieldLabel,
  CredentialFieldReveal,
  CredentialFieldRoot,
  CredentialFieldValue,
} from './credential-field';

export const CredentialField = {
  Root: CredentialFieldRoot,
  Label: CredentialFieldLabel,
  Value: CredentialFieldValue,
  Reveal: CredentialFieldReveal,
  Copy: CredentialFieldCopy,
};
export { useCredentialField } from './credential-field.context';
