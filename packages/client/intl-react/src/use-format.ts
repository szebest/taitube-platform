import type { IntlBinding } from '@vp/intl';
import { useIntlBindings } from './intl-context';

export function useFormat(): IntlBinding {
  return useIntlBindings('useFormat').intl;
}
