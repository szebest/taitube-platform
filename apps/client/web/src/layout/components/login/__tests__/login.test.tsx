import { account, channel } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { Login } from '../login';

describe('apps/client/web: login', () => {
  it('shows nothing to a guest', async () => {
    expect(await renderPage(<Login />, AppProviders)).toBe('');
  });

  it('shows a signed-in viewer their channel name and avatar behind the settings toggle', async () => {
    const viewer = account({
      channel: channel({ avatarUrl: 'http://localhost:9000/avatars/creator.png' }),
    });

    const markup = await renderPage(<Login />, signedIn(viewer));

    expect(markup).toContain('The Creator');
    expect(markup).toContain('aria-label="settings"');
    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
  });
});
