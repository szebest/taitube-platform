import {
  SecretRevealAcknowledge,
  SecretRevealCopy,
  SecretRevealDone,
  SecretRevealLabel,
  SecretRevealNotice,
  SecretRevealRoot,
  SecretRevealValue,
} from './secret-reveal';

export const SecretReveal = {
  Root: SecretRevealRoot,
  Notice: SecretRevealNotice,
  Label: SecretRevealLabel,
  Value: SecretRevealValue,
  Copy: SecretRevealCopy,
  Acknowledge: SecretRevealAcknowledge,
  Done: SecretRevealDone,
};
export { useSecretReveal } from './secret-reveal.context';
