import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: ActiveChannelProvider', () => {
  it('acts on the viewer’s own channel when none is chosen', async () => {
    const { requests } = await renderTeam('/team', {
      state: { memberships: [membership('editor')] },
    });

    await screen.findByText('No one else yet');

    expect(requests.teamChannels).toEqual([null]);
  });

  it('acts on the channel the viewer last chose and holds the role they have there', async () => {
    await renderTeam('/team', {
      state: { memberships: [membership('editor')] },
      actingOn: OTHER_CHANNEL_ID,
    });

    expect(await screen.findByText('Only managers see the team')).toBeInTheDocument();
  });

  it('puts a viewer whose membership ended back on their own channel on the next page they open', async () => {
    const { requests } = await renderTeam('/team', { actingOn: OTHER_CHANNEL_ID });

    await screen.findByText('No one else yet');

    expect(requests.teamChannels).toEqual([null]);
  });

  it('gives a guest the sign-in page and no channel', async () => {
    await renderRoute(getRouter, '/login');

    expect(await screen.findByRole('navigation', { name: 'Studio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch channel' })).toBeNull();
  });
});
