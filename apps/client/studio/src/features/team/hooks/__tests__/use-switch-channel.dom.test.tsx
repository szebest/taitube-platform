import { screen } from '@testing-library/react';
import { listCreatorComments } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership } from '#app/features/team/__tests__/team-api.fixture';

const emptyInbox = mockEndpoint(listCreatorComments, () =>
  HttpResponse.json({ items: [], nextCursor: null })
);

describe('apps/client/studio: useSwitchChannel', () => {
  it.each<{ role: ChannelRole; lands: string }>([
    { role: 'manager', lands: '/videos' },
    { role: 'editor', lands: '/videos' },
    { role: 'moderator', lands: '/comments' },
  ])('lands a $role on $lands', async ({ role, lands }) => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    const { user, router } = await renderTeam('/team', {
      state: { memberships: [membership(role)] },
      handlers: [emptyInbox],
    });

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Other Show/ }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe(lands));
  });

  it('forgets what the cache held for the channel the viewer left', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    const { user, queryClient } = await renderTeam('/team', {
      state: { memberships: [membership('editor')] },
      handlers: [emptyInbox],
    });
    queryClient.setQueryData(['videos', 'mine'], ['cached for the own channel']);

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitemradio', { name: /Other Show/ }));

    await vi.waitFor(() => expect(queryClient.getQueryData(['videos', 'mine'])).toBeUndefined());
  });
});
