import type { Decorator } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/queries/intl';
import { WEB_MESSAGES } from '#app/lib/messages';

export const withPartyIntl: Decorator = (Story) => (
  <IntlProvider
    messages={WEB_MESSAGES}
    locale={FALLBACK_ACTIVE_LOCALE.locale}
    catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
    timeZone="UTC"
  >
    <Story />
  </IntlProvider>
);
