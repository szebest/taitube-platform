import { screen, waitFor, within } from '@testing-library/react';
import {
  type ContractBody,
  createWatchParty,
  getWatchParty,
  inviteToWatchParty,
  listWatchPartyInviteCandidates,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import {
  account,
  mockEndpoint,
  PARTY_ID,
  partyPreview,
  partyRoom,
  problemReply,
  VIDEO_ID,
} from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const ANA = '0190c3a0-5e1d-7000-8000-00000000d001';

const candidates = mockEndpoint(listWatchPartyInviteCandidates, () =>
  HttpResponse.json({
    items: [
      {
        userId: ANA,
        handle: 'ana',
        displayName: 'Ana Reis',
        avatarUrl: null,
        reason: 'co_watcher',
        inRoom: false,
        invited: false,
      },
    ],
  })
);

describe('apps/client/web: watch together dialog', () => {
  it('asks for the room again without the start time once that is switched off', async () => {
    const bodies: ContractBody<typeof createWatchParty>[] = [];
    const { user } = await renderWatch({
      viewer: account(),
      handlers: [
        candidates,
        mockEndpoint(createWatchParty, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(partyRoom(), { status: 201 });
        }),
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Watch together' }));
    const dialog = await screen.findByRole('dialog', { name: 'Watch together' });
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Start at 01:15' }));

    await waitFor(() =>
      expect(bodies.map((body) => body.source)).toEqual([
        { videoId: VIDEO_ID, startMs: 75_000 },
        { videoId: VIDEO_ID },
      ])
    );
    expect(await within(dialog).findByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('says the room could not be made and tries again', async () => {
    let attempts = 0;
    const { user } = await renderWatch({
      viewer: account(),
      handlers: [
        candidates,
        mockEndpoint(createWatchParty, () => {
          attempts += 1;
          return attempts === 1
            ? problemReply(ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE)
            : HttpResponse.json(partyRoom(), { status: 201 });
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Watch together' }));
    const dialog = await screen.findByRole('dialog', { name: 'Watch together' });
    await user.click(await within(dialog).findByRole('button', { name: 'Try again' }));

    expect(await within(dialog).findByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('invites a person from the picker and goes to the party', async () => {
    const invited: unknown[] = [];
    const { user, router } = await renderWatch({
      viewer: account(),
      handlers: [
        candidates,
        mockEndpoint(createWatchParty, () => HttpResponse.json(partyRoom(), { status: 201 })),
        mockEndpoint(getWatchParty, () => HttpResponse.json(partyPreview())),
        mockEndpoint(inviteToWatchParty, async ({ request }) => {
          invited.push(await request.json());
          return HttpResponse.json({ sent: [], folded: [], refused: [] }, { status: 201 });
        }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Watch together' }));
    const dialog = await screen.findByRole('dialog', { name: 'Watch together' });
    const person = (await within(dialog).findByText('Ana Reis')).closest('li');
    await user.click(within(person as HTMLElement).getByRole('button', { name: 'Invite' }));

    await waitFor(() => expect(invited).toEqual([{ userIds: [ANA] }]));
    await user.click(within(dialog).getByRole('button', { name: 'Go to party' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/parties/${PARTY_ID}`));
  });
});
