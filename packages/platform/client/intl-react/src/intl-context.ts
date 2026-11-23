import type { IntlBinding } from '@kit/intl';
import { createContext, useContext } from 'react';

export interface IntlBindings {
  readonly intl: IntlBinding;
}

export const IntlContext = createContext<IntlBindings | undefined>(undefined);

export function useIntlBindings(hook: string): IntlBindings {
  const bindings = useContext(IntlContext);
  if (bindings === undefined) {
    throw new Error(`${hook} must be called inside <IntlProvider>, which supplies its locale`);
  }
  return bindings;
}
