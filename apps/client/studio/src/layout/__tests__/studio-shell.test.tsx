import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { StudioShell } from '../studio-shell';

const renderShell = (Providers = AppProviders) => renderPage(<StudioShell />, Providers);

describe('apps/client/studio: shell', () => {
  it('frames every page with the logo, the appearance menu and the way back to the viewer app', async () => {
    const markup = await renderShell();

    expect(markup).toContain('aria-label="Taitube"');
    expect(markup).toContain('Creator Studio');
    expect(markup).toContain('aria-label="Appearance"');
    expect(markup).toContain('href="http://localhost:5173"');
    expect(markup).toContain('Back to Taitube');
  });

  it.each([
    { viewer: 'a guest', Providers: AppProviders, shown: '>Sign in</a>', hidden: 'The Creator' },
    {
      viewer: 'a signed-in creator',
      Providers: signedIn(),
      shown: 'The Creator',
      hidden: 'Sign in',
    },
  ])('shows $viewer their account', async ({ Providers, shown, hidden }) => {
    const markup = await renderShell(Providers);

    expect(markup).toContain(shown);
    expect(markup).not.toContain(hidden);
  });
});
