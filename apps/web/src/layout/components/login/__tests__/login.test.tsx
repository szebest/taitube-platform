import { stubBrowser } from '#app/__tests__/browser';
import { account, channel } from '#app/__tests__/fixtures';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { Login } from '../login';

describe('apps/web: login', () => {
  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('shows nothing to $scenario', async ({ token }) => {
    stubBrowser({ token });

    expect(await renderPage(<Login />)).toBe('');
  });

  it('shows a signed-in viewer their channel name and avatar behind the settings toggle', async () => {
    const queryClient = createQueryClient();
    signIn(queryClient, {
      ...account(),
      channel: channel({ avatarUrl: 'http://localhost:9000/avatars/creator.png' }),
    });

    const markup = await renderPage(<Login />, { queryClient });

    expect(markup).toContain('The Creator');
    expect(markup).toContain('aria-label="settings"');
    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
  });
});
