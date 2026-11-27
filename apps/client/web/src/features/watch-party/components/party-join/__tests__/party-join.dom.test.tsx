import { screen } from '@testing-library/react';
import { joinWatchParty } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, PARTY_ID, partyMembership, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderPartyRoute } from '#app/features/watch-party/__tests__/render-party-route';

describe('apps/client/web: PartyJoin', () => {
  it('offers Discord nowhere until its integration is configured', async () => {
    await renderPartyRoute({ preview: { viewer: { actions: ['guest', 'discord', 'sign_in'] } } });

    expect(screen.queryByRole('button', { name: 'Join with Discord' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends "Sign in" to the login page, back to this room and its invite', async () => {
    const { user, router } = await renderPartyRoute({ path: `/parties/${PARTY_ID}?invite=inv-1` });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({
      redirect: `/parties/${PARTY_ID}?invite=inv-1`,
    });
  });

  it('joins with the password and the invite from the link', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderPartyRoute({
      path: `/parties/${PARTY_ID}?invite=inv-1`,
      preview: { hasPassword: true, viewer: { canJoin: 'password', actions: [] } },
      handlers: [
        mockEndpoint(joinWatchParty, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ membership: partyMembership() });
        }),
      ],
    });

    await user.type(screen.getByLabelText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    await vi.waitFor(() => expect(bodies).toEqual([{ password: 'hunter2', invite: 'inv-1' }]));
  });

  it.each([
    { code: ErrorCodes.WATCH_PARTY_PASSWORD_INVALID, shown: 'That password is not right' },
    {
      code: ErrorCodes.WATCH_PARTY_PASSWORD_LOCKED,
      shown: 'Too many tries. Try again in a few minutes.',
    },
  ])('says what went wrong for $code', async ({ code, shown }) => {
    const { user } = await renderPartyRoute({
      preview: { hasPassword: true, viewer: { canJoin: 'password', actions: [] } },
      handlers: [mockEndpoint(joinWatchParty, () => problemReply(code))],
    });

    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText(shown)).toBeInTheDocument();
  });

  it('shows a full room with Join disabled', async () => {
    await renderPartyRoute({
      preview: {
        presentCount: 10,
        effectiveCapacity: 10,
        viewer: { canJoin: 'full', actions: [] },
      },
    });

    expect(screen.getByText('This party is full (10 of 10)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
  });
});
