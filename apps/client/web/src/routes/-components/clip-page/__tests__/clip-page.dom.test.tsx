import { axeViolations } from '@kit/web-testing/dom';
import { screen } from '@testing-library/react';
import { createWatchParty, listWatchPartyInviteCandidates } from '@vp/api-contracts';
import { account, mockEndpoint, PARTY_ID, partyRoom, VIDEO_ID } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { viewerAccount } from '#app/__tests__/comment-fixtures';
import { LazyWatchTogetherContent } from '#app/components/party/watch-together/watch-together.lazy';
import { renderClip } from '#app/features/clips/__tests__/render-clip';

beforeAll(() => LazyWatchTogetherContent.preload());

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000b002';

describe('apps/client/web: clip page', () => {
  it('names the clip and plays its range from the video', async () => {
    await renderClip();

    expect(screen.getByRole('heading', { level: 1, name: 'The best part' })).toBeInTheDocument();
    expect(screen.getByTestId('player')).toHaveAttribute('data-range', '20000-30000');
  });

  it('links to the full video at the second the clip starts', async () => {
    await renderClip({ clip: { startMs: 20_900, endMs: 40_000 } });

    expect(screen.getByRole('link', { name: 'Watch the full video' })).toHaveAttribute(
      'href',
      `/watch/${VIDEO_ID}?t=20`
    );
  });

  it.each([
    { viewer: 'a guest', as: undefined },
    { viewer: 'its creator', as: account() },
  ])('has no axe violation for $viewer', async ({ as }) => {
    await renderClip({ viewer: as });

    expect(await axeViolations()).toEqual([]);
  });

  it.each([
    { viewer: 'a guest', as: undefined, sees: false },
    { viewer: 'another viewer', as: viewerAccount(OTHER_ID), sees: false },
    { viewer: 'its creator', as: account(), sees: true },
  ])('offers Delete clip to $viewer: $sees', async ({ as, sees }) => {
    await renderClip({ viewer: as });

    expect(screen.queryByRole('button', { name: 'Delete clip' }) !== null).toBe(sees);
  });

  it('makes a room that starts where the clip does, and offers its link', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderClip({
      viewer: account(),
      handlers: [
        mockEndpoint(createWatchParty, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json(partyRoom(), { status: 201 });
        }),
        mockEndpoint(listWatchPartyInviteCandidates, () => HttpResponse.json({ items: [] })),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Watch together' }));
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(await navigator.clipboard.readText()).toBe(`http://localhost:3000/parties/${PARTY_ID}`);
    expect(bodies).toEqual([
      expect.objectContaining({ source: { videoId: VIDEO_ID, startMs: 20_000 } }),
    ]);
  });

  it('asks a guest who wants to watch together to sign in', async () => {
    const { user } = await renderClip();

    await user.click(screen.getByRole('button', { name: 'Watch together' }));

    expect(
      await screen.findByRole('dialog', { name: 'Sign in to watch together' })
    ).toBeInTheDocument();
  });
});
