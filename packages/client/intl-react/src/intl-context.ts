import type { IntlBinding } from '@vp/intl';
import type { Translator } from '@vp/messages';
import { createContext, useContext } from 'react';

export interface IntlBindings {
  readonly intl: IntlBinding;
  readonly translator: Translator;
}

export const IntlContext = createContext<IntlBindings | undefined>(undefined);

export function useIntlBindings(hook: string): IntlBindings {
  const bindings = useContext(IntlContext);
  if (bindings === undefined) {
    throw new Error(`${hook} must be called inside <IntlProvider>, which supplies its locale`);
  }
  return bindings;
}
