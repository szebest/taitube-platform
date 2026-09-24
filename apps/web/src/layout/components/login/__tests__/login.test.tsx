import { createApiStore } from '../../../../__tests__/api-store';
import { stubBrowser } from '../../../../__tests__/browser';
import { account, channel } from '../../../../__tests__/fixtures';
import { renderPage, signIn } from '../../../../__tests__/render-page';
import { Login } from '../login';

describe('apps/web: login', () => {
  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('shows nothing to $scenario', ({ token }) => {
    stubBrowser({ token });

    expect(renderPage(<Login />)).toBe('');
  });

  it('shows a signed-in viewer their channel name and avatar behind the settings toggle', async () => {
    const store = createApiStore();
    await signIn(store, {
      ...account(),
      channel: channel({ avatarUrl: 'http://localhost:9000/avatars/creator.png' }),
    });

    const markup = renderPage(<Login />, { store });

    expect(markup).toContain('The Creator');
    expect(markup).toContain('aria-label="settings"');
    expect(markup).toContain('src="http://localhost:9000/avatars/creator.png"');
  });
});
