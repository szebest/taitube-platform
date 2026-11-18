import type { IntlBinding } from '@kit/intl';
import { useIntlBindings } from './intl-context';

export function useFormat(): IntlBinding {
  return useIntlBindings('useFormat').intl;
}
