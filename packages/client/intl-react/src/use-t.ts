import type { Translator } from '@vp/messages';
import { useIntlBindings } from './intl-context';

export function useT(): Translator {
  return useIntlBindings('useT').translator;
}
