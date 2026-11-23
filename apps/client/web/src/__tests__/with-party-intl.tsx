import type { Decorator } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE } from '@vp/queries/intl';
import { IntlProvider } from '#app/lib/messages/intl-provider';

export const withPartyIntl: Decorator = (Story) => (
  <IntlProvider
    locale={FALLBACK_ACTIVE_LOCALE.locale}
    catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
    timeZone="UTC"
  >
    <Story />
  </IntlProvider>
);
