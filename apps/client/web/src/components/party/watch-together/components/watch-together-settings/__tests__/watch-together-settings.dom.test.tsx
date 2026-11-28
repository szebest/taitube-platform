import { screen, waitFor, within } from '@testing-library/react';
import {
  type ContractBody,
  createWatchParty,
  createWatchPartyInviteLink,
  listWatchPartyInviteCandidates,
  updateWatchParty,
} from '@vp/api-contracts';
import { account, mockEndpoint, PARTY_ID, partyRoom } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const candidates = mockEndpoint(listWatchPartyInviteCandidates, () =>
  HttpResponse.json({ items: [] })
);

async function openDialog(room: Parameters<typeof partyRoom>[0], handlers: HttpHandler[] = []) {
  const rendered = await renderWatch({
    viewer: account(),
    handlers: [
      candidates,
      mockEndpoint(createWatchParty, () => HttpResponse.json(partyRoom(room), { status: 201 })),
      ...handlers,
    ],
  });
  await rendered.user.click(screen.getByRole('button', { name: 'Watch together' }));
  const dialog = await screen.findByRole('dialog', { name: 'Watch together' });
  return { ...rendered, dialog };
}

describe('apps/client/web: watch together settings', () => {
  it('saves the changed settings against the room version', async () => {
    const bodies: ContractBody<typeof updateWatchParty>[] = [];
    const { user, dialog } = await openDialog({ version: 4 }, [
      mockEndpoint(updateWatchParty, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(partyRoom({ name: 'Friday film', version: 5 }));
      }),
    ]);

    await user.click(await within(dialog).findByText('Room settings'));
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Friday film');
    await user.click(within(dialog).getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ name: 'Friday film', version: 4, allowGuests: true });
  });

  it('copies a link that skips the password for a private room, until that is switched off', async () => {
    const { user, dialog } = await openDialog({ visibility: 'private' }, [
      mockEndpoint(createWatchPartyInviteLink, () =>
        HttpResponse.json(
          {
            id: '0190c3a0-5e1d-7000-8000-00000000e001',
            token: 'tok-1',
            url: `/parties/${PARTY_ID}?invite=tok-1`,
            expiresAt: '2999-01-01T00:00:00.000Z',
          },
          { status: 201 }
        )
      ),
    ]);

    const field = () => within(dialog).getByRole('textbox', { name: 'Party link' });
    await waitFor(() => expect(field()).toHaveTextContent('invite=tok-1'));

    await user.click(within(dialog).getByRole('checkbox', { name: 'Link skips the password' }));

    expect(field()).not.toHaveTextContent('invite=');
  });
});
