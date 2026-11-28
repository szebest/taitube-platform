import { waitFor, within } from '@testing-library/react';
import { declineWatchPartyInvite, getWatchParty, joinWatchParty } from '@vp/api-contracts';
import { mockEndpoint, PARTY_ID, partyMembership, partyPreview } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import {
  notification,
  PARTY_INVITE_ID,
  partyInvite,
} from '#app/features/notifications/__tests__/notification-fixtures';
import { renderBell } from '#app/features/notifications/__tests__/render-bell';

describe('apps/client/web: party invite row', () => {
  function renderInvite(party: Parameters<typeof partyInvite>[0] = {}) {
    const joined: unknown[] = [];
    const declined: string[] = [];
    const rendered = renderBell({
      unreadCount: 1,
      items: [partyInvite(party)],
      handlers: [
        mockEndpoint(getWatchParty, () => HttpResponse.json(partyPreview())),
        mockEndpoint(joinWatchParty, async ({ request }) => {
          joined.push(await request.json());
          return HttpResponse.json({ membership: partyMembership() });
        }),
        mockEndpoint(declineWatchPartyInvite, ({ params }) => {
          declined.push(String(params.inviteId));
          return new HttpResponse(null, { status: 204 });
        }),
      ],
    });
    return { rendered, joined, declined };
  }

  it('joins the room on its invite from anywhere on the row, and says who is watching', async () => {
    const { rendered, joined } = renderInvite();
    const { user, router, openBell, marked } = await rendered;

    const row = await within(await openBell()).findByRole('link', { name: /Join$/ });
    expect(row).toHaveTextContent('Ana, Tom, and 3 others are watching');
    await user.click(row);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/parties/${PARTY_ID}`));
    expect(router.state.location.search).toEqual({ invite: PARTY_INVITE_ID });
    await waitFor(() => expect(joined).toEqual([{ invite: PARTY_INVITE_ID }]));
    expect(marked).toEqual([{ ids: [notification().id] }]);
  });

  it('declines without joining: the pill goes, the row is read, nobody else is touched', async () => {
    const { rendered, joined, declined } = renderInvite();
    const { user, openBell, marked } = await rendered;

    const panel = await openBell();
    await user.click(await within(panel).findByRole('button', { name: 'Decline invite' }));

    await waitFor(() => expect(declined).toEqual([PARTY_INVITE_ID]));
    expect(marked).toEqual([{ ids: [notification().id] }]);
    await waitFor(() =>
      expect(within(panel).queryByRole('button', { name: 'Decline invite' })).toBeNull()
    );
    expect(within(panel).getByRole('link')).not.toHaveTextContent('Join');
    expect(joined).toEqual([]);
  });

  it('says Ended once it expired, still opens the room and offers no decline', async () => {
    const { rendered, joined } = renderInvite({ expiresAt: '2000-01-01T00:00:00.000Z' });
    const { user, router, openBell } = await rendered;

    const panel = await openBell();
    const row = await within(panel).findByRole('link', { name: /Ended$/ });
    expect(within(panel).queryByRole('button', { name: 'Decline invite' })).toBeNull();
    await user.click(row);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/parties/${PARTY_ID}`));
    expect(joined).toEqual([]);
  });
});
