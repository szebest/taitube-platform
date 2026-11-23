import {
  IntlProvider as SharedIntlProvider,
  type IntlProviderProps as SharedIntlProviderProps,
} from '@vp/queries/intl';
import { STUDIO_MESSAGES, type StudioCatalogue } from './index';

export type IntlProviderProps = Omit<SharedIntlProviderProps<StudioCatalogue>, 'messages'>;

/** The shared `IntlProvider` with the studio's words, for a spec or a story that mounts no router. */
export function IntlProvider(props: IntlProviderProps) {
  return <SharedIntlProvider<StudioCatalogue> {...props} messages={STUDIO_MESSAGES} />;
}
