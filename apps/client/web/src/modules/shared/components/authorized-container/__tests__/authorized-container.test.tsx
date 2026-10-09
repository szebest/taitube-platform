import type { QueryClient } from '@tanstack/react-query';
import { stubBrowser } from '#app/__tests__/browser';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { AuthorizedContainer } from '../authorized-container';

async function renderGuarded(queryClient: QueryClient): Promise<string> {
  return renderPage(
    <AuthorizedContainer>
      <span>members only</span>
    </AuthorizedContainer>,
    { queryClient }
  );
}

describe('apps/web: authorized container', () => {
  it('shows its content to a signed-in viewer', async () => {
    const queryClient = signIn();

    expect(await renderGuarded(queryClient)).toContain('members only');
  });

  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('hides its content from $scenario', async ({ token }) => {
    stubBrowser({ token });

    expect(await renderGuarded(createQueryClient())).toBe('');
  });
});
