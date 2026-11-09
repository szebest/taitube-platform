import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { STUDIO_URL } from '#app/lib/config';
import { ShellDestinationLink } from '../shell-destination-link';

describe('apps/client/web: shell destination link', () => {
  it.each([
    { target: { kind: 'page', to: '/shorts' } as const, href: '/shorts' },
    { target: { kind: 'channel', channelId: 'c1' } as const, href: '/channel/c1' },
    { target: { kind: 'studio' } as const, href: STUDIO_URL },
  ])('links a $target.kind destination to $href', async ({ target, href }) => {
    const html = await renderPage(
      <ShellDestinationLink destination={target}>Go</ShellDestinationLink>,
      AppProviders
    );

    expect(html).toContain(`href="${href}"`);
  });
});
