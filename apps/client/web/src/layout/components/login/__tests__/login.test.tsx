import { account, channel } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signIn, stubSession } from '#app/__tests__/providers';
import { Login } from '../login';

describe('apps/client/web: login', () => {
  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('shows nothing to $scenario', async ({ token }) => {
    stubSession(token);

    expect(await renderPage(<Login />, AppProviders)).toBe('');
  });

  it('shows a signed-in viewer their channel name and avatar behind the settings toggle', async () => {
    const queryClient = signIn({
      ...account(),
      channel: channel({ avatarUrl: 'http://localhost:9000/avatars/creator.png' }),
    });

    const markup = await renderPage(<Login />, AppProviders, { queryClient });

    expect(markup).toContain('The Creator');
    expect(markup).toContain('aria-label="settings"');
    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
  });
});
