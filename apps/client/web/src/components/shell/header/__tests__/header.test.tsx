import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { Header } from '../header';

const renderHeader = (Providers = AppProviders) =>
  renderPage(
    <AppearanceProvider
      stored={{ preference: { ...DEFAULT_APPEARANCE, mode: 'dark' }, source: 'none' }}
    >
      <Header sidebarId="sidebar" sidebarExpanded onToggleSidebar={() => undefined} />
    </AppearanceProvider>,
    Providers
  );

describe('apps/client/web: shell header', () => {
  it.each([
    { viewer: 'a guest', Providers: AppProviders, shown: '>Sign in</a>', hidden: 'The Creator' },
    {
      viewer: 'a signed-in viewer',
      Providers: signedIn(),
      shown: 'The Creator',
      hidden: 'Sign in',
    },
  ])('shows $viewer the account menu', async ({ Providers, shown, hidden }) => {
    const markup = await renderHeader(Providers);

    expect(markup).toContain(shown);
    expect(markup).not.toContain(hidden);
  });
});
