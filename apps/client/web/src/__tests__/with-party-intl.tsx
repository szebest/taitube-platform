import { FALLBACK_ACTIVE_LOCALE, IntlProvider } from '@kit/intl-react';
import type { Decorator } from '@storybook/react-vite';

export const withPartyIntl: Decorator = (Story) => (
  <IntlProvider
    locale={FALLBACK_ACTIVE_LOCALE.locale}
    catalogues={FALLBACK_ACTIVE_LOCALE.catalogues}
    timeZone="UTC"
  >
    <Story />
  </IntlProvider>
);
