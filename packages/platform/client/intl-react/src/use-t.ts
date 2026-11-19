import { type RegisteredTranslator, useIntlBindings } from './intl-context';

export function useT(): RegisteredTranslator {
  return useIntlBindings('useT').translator;
}
