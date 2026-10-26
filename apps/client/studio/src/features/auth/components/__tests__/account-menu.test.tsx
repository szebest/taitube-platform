import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { AccountMenu } from '../account-menu';

const renderMenu = (Providers = AppProviders) => renderPage(<AccountMenu />, Providers);

describe('apps/client/studio: account menu', () => {
  it.each([
    { viewer: 'a guest', Providers: AppProviders, shown: '>Sign in</a>', hidden: 'Account' },
    {
      viewer: 'a signed-in creator',
      Providers: signedIn(),
      shown: 'data-slot="account-menu-trigger"',
      hidden: 'Sign in',
    },
  ])('shows $viewer the account menu', async ({ Providers, shown, hidden }) => {
    const markup = await renderMenu(Providers);

    expect(markup).toContain(shown);
    expect(markup).not.toContain(hidden);
  });
});
