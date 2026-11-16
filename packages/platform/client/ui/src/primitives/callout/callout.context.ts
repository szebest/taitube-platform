import { createCompoundContext } from '../../lib/create-compound-context';
import type { CalloutFill, CalloutTone } from './types';

export const [CalloutContext, useCallout] = createCompoundContext<{
  variant: CalloutFill;
  tone: CalloutTone;
}>('Callout');
