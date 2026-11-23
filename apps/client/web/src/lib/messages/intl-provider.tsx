import {
  IntlProvider as SharedIntlProvider,
  type IntlProviderProps as SharedIntlProviderProps,
} from '@vp/queries/intl';
import { WEB_MESSAGES, type WebCatalogue } from './index';

export type IntlProviderProps = Omit<SharedIntlProviderProps<WebCatalogue>, 'messages'>;

/** The shared `IntlProvider` with the web's words, for a spec or a story that mounts no router. */
export function IntlProvider(props: IntlProviderProps) {
  return <SharedIntlProvider<WebCatalogue> {...props} messages={WEB_MESSAGES} />;
}
