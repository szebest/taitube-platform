import { expectOk } from '@kit/testing/result';
import { presentCards } from '../watch-party-card-views';
import { OWNER, seedParty, startParty, VIDEO_A, watchPartyTestDeps } from './watch-party-test-deps';

describe('apps/server/api/services: presentCards', () => {
  it('shows the channel a room is hosted as, the owner, the capacity left and the clock snapshot', async () => {
    const test = watchPartyTestDeps();
    await seedParty(test);
    const room = await startParty(test, {
      visibility: 'public',
      hostAs: 'channel',
      capacity: 10,
      source: { videoId: VIDEO_A },
    });
    const rows = expectOk(
      await test.repositories.watchPartyRooms.listDiscoverable({
        filters: {
          text: null,
          status: 'all',
          categoryId: null,
          language: null,
          access: 'any',
          size: 'any',
          space: false,
          followed: false,
          creator: false,
          kind: 'any',
        },
        sort: 'members',
        mode: 'lexical',
        viewerId: null,
        ceiling: test.deps.config.maxMembers,
        now: test.deps.now(),
        after: null,
        limit: 24,
      })
    );

    const [card] = expectOk(await presentCards(test.deps, rows));

    expect(card).toMatchObject({
      id: room.id,
      owner: { memberKey: `user:${OWNER.id}`, name: 'Olivia Owner' },
      channel: { handle: 'owner', displayName: 'Olivia Owner' },
      capacity: 10,
      effectiveCapacity: 10,
      currentVideo: { id: VIDEO_A, title: 'First' },
      serverNow: test.deps.now().getTime(),
      playback: { phase: 'lobby' },
    });
  });
});
