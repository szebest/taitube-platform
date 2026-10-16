import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signIn, stubSession } from '#app/__tests__/providers';
import { AuthorizedContainer } from '../authorized-container';

async function renderGuarded(queryClient: QueryClient): Promise<string> {
  return renderPage(
    <AuthorizedContainer>
      <span>members only</span>
    </AuthorizedContainer>,
    AppProviders,
    { queryClient }
  );
}

describe('apps/client/web: authorized container', () => {
  it('shows its content to a signed-in viewer', async () => {
    const queryClient = signIn();

    expect(await renderGuarded(queryClient)).toContain('members only');
  });

  it.each<{ scenario: string; token?: string }>([
    { scenario: 'a guest', token: undefined },
    { scenario: 'a viewer whose account is still loading', token: 'signed-in' },
  ])('hides its content from $scenario', async ({ token }) => {
    stubSession(token);

    expect(await renderGuarded(createQueryClient())).toBe('');
  });
});
