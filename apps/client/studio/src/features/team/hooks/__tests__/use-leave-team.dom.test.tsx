import { screen } from '@testing-library/react';
import { createActingChannelStore } from '@vp/queries';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: useLeaveTeam', () => {
  it('leaves on the acting channel, then forgets it and reads the memberships again', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    const { user, requests, router } = await renderTeam('/team', {
      state: { memberships: [membership('analytics')] },
      actingOn: OTHER_CHANNEL_ID,
    });
    expect(createActingChannelStore().read()).toBe(OTHER_CHANNEL_ID);

    await user.click(screen.getByRole('button', { name: 'Switch channel' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Leave this team' }));
    await user.click(await screen.findByRole('button', { name: 'Leave team' }));

    await vi.waitFor(() => expect(createActingChannelStore().read()).toBeUndefined());
    expect(requests.removedFrom).toEqual([OTHER_CHANNEL_ID]);
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/videos'));
    await vi.waitFor(() => expect(router.state.status).toBe('idle'));
  });
});
