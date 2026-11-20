import type { IntlBinding } from '@kit/intl';
import { createContext, useContext } from 'react';

/**
 * The app names its translator type by merging into this interface, once, where it builds its
 * provider: `declare module '@kit/intl-react' { interface IntlRegister { translator: AppTranslator } }`.
 * `useT` then returns it.
 *
 * @public
 */
// oxlint-disable-next-line typescript/no-empty-interface -- declaration merging: the app adds its translator type.
export interface IntlRegister {}

/** @public */
export type RegisteredTranslator = IntlRegister extends { readonly translator: infer Translator }
  ? Translator
  : never;

export interface IntlBindings {
  readonly intl: IntlBinding;
  readonly translator: RegisteredTranslator;
}

export const IntlContext = createContext<IntlBindings | undefined>(undefined);

export function useIntlBindings(hook: string): IntlBindings {
  const bindings = useContext(IntlContext);
  if (bindings === undefined) {
    throw new Error(`${hook} must be called inside <IntlProvider>, which supplies its locale`);
  }
  return bindings;
}
