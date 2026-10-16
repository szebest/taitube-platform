import { CHANNEL_ID, stubBrowser } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders, inChrome, signedIn } from '#app/__tests__/providers';
import { Sidebar } from '../sidebar';

const MEMBER_LINKS = [
  'href="/subscriptions/videos"',
  `href="/channel/${CHANNEL_ID}"`,
  'href="/subscriptions"',
];

describe('apps/client/web: sidebar', () => {
  it('gives a guest the public pages only', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Sidebar />), AppProviders);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/trending"');
    for (const link of MEMBER_LINKS) expect(markup).not.toContain(link);
  });

  it('adds the member pages for a signed-in viewer', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Sidebar />), signedIn());

    for (const link of MEMBER_LINKS) expect(markup).toContain(link);
  });

  it('server-renders the wide layout on a narrow screen, so hydration matches it', async () => {
    stubBrowser();
    vi.stubGlobal('window', { ...window, matchMedia: () => ({ matches: true }) });

    const markup = await renderPage(inChrome(<Sidebar />), AppProviders);

    expect(markup).not.toMatch(/class="[^"]*ps-broken/);
  });
});
