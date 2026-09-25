import { type ApiStore, createApiStore } from '../../../../../__tests__/api-store';
import { stubBrowser } from '../../../../../__tests__/browser';
import { account } from '../../../../../__tests__/fixtures';
import { renderPage, signIn } from '../../../../../__tests__/render-page';
import { AuthorizedContainer } from '../authorized-container';

async function renderGuarded(store: ApiStore): Promise<string> {
  return renderPage(
    <AuthorizedContainer>
      <span>members only</span>
    </AuthorizedContainer>,
    { store }
  );
}

describe('apps/web: authorized container', () => {
  it('shows its content to a signed-in viewer', async () => {
    const store = createApiStore();
    await signIn(store, account());

    expect(await renderGuarded(store)).toContain('members only');
  });

  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('hides its content from $scenario', async ({ token }) => {
    stubBrowser({ token });

    expect(await renderGuarded(createApiStore())).toBe('');
  });
});
