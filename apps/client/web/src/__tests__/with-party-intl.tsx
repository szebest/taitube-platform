import type { Decorator } from '@storybook/react-vite';
import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@vp/queries/intl';

export const withPartyIntl: Decorator = (Story) => (
  <IntlProvider
    locale={FALLBACK_ACTIVE_LOCALE.locale}
    catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
    timeZone="UTC"
  >
    <Story />
  </IntlProvider>
);
