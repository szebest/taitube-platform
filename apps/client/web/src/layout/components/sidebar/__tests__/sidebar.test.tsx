import { CHANNEL_ID, stubBrowser } from '@vp/web-testing';

import { inChrome, renderPage, signIn, stubSession } from '#app/__tests__/render-page';
import { Sidebar } from '../sidebar';

const MEMBER_LINKS = [
  'href="/subscriptions/videos"',
  `href="/channel/${CHANNEL_ID}"`,
  'href="/subscriptions"',
];

describe('apps/client/web: sidebar', () => {
  it('keeps its width but lists nothing while the account is loading', async () => {
    stubSession('signed-in');

    const markup = await renderPage(inChrome(<Sidebar />));

    expect(markup).toContain('width:220px');
    expect(markup).not.toContain('Home');
  });

  it('gives a guest the public pages only', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Sidebar />));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/trending"');
    for (const link of MEMBER_LINKS) expect(markup).not.toContain(link);
  });

  it('adds the member pages for a signed-in viewer', async () => {
    const queryClient = signIn();

    const markup = await renderPage(inChrome(<Sidebar />), { queryClient });

    for (const link of MEMBER_LINKS) expect(markup).toContain(link);
  });

  it('server-renders the wide layout on a narrow screen, so hydration matches it', async () => {
    stubBrowser();
    vi.stubGlobal('window', { ...window, matchMedia: () => ({ matches: true }) });

    const markup = await renderPage(inChrome(<Sidebar />));

    expect(markup).not.toMatch(/class="[^"]*ps-broken/);
  });
});
