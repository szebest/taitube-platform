import { screen } from '@testing-library/react';
import { listMyIdentities } from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
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

  it("acts on the channel the tab's identity names, over the one last chosen here", async () => {
    await renderTeam('/u/0/c/othershow/team', {
      state: { memberships: [membership('editor')] },
      handlers: [
        mockEndpoint(listMyIdentities, () =>
          HttpResponse.json({
            account: { id: account().user.id, email: account().user.email },
            owned: [],
            member: [
              {
                id: OTHER_CHANNEL_ID,
                handle: 'othershow',
                displayName: 'Other Show',
                avatarUrl: null,
                role: 'editor',
                ownerId: account().user.id,
              },
            ],
          })
        ),
      ],
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
