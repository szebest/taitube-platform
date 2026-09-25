import { createApiStore } from '../../../../__tests__/api-store';
import { stubBrowser } from '../../../../__tests__/browser';
import { CHANNEL_ID, account } from '../../../../__tests__/fixtures';
import { inChrome, renderPage, signIn } from '../../../../__tests__/render-page';
import { Sidebar } from '../sidebar';

const MEMBER_LINKS = ['href="/subscriptions/videos"', `href="/channel/${CHANNEL_ID}"`, 'href="/subscriptions"'];

describe('apps/web: sidebar', () => {
  it('keeps its width but lists nothing while the account is loading', () => {
    stubBrowser({ token: 'signed-in' });

    const markup = renderPage(inChrome(<Sidebar />));

    expect(markup).toContain('width:220px');
    expect(markup).not.toContain('Home');
  });

  it('gives a guest the public pages only', () => {
    stubBrowser();

    const markup = renderPage(inChrome(<Sidebar />));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/trending"');
    for (const link of MEMBER_LINKS) expect(markup).not.toContain(link);
  });

  it('adds the member pages for a signed-in viewer', async () => {
    const store = createApiStore();
    await signIn(store, account());

    const markup = renderPage(inChrome(<Sidebar />), { store });

    for (const link of MEMBER_LINKS) expect(markup).toContain(link);
  });
});
