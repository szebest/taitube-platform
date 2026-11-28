import { refreshSearchText } from '../watch-party-search-text';
import {
  OWNER,
  seedParty,
  startParty,
  VIDEO_A,
  VIDEO_B,
  watchPartyTestDeps,
} from './watch-party-test-deps';

describe('apps/server/api/services: refreshSearchText', () => {
  it('writes the room name, the owner handle and display name and the video title', async () => {
    const test = watchPartyTestDeps();
    await seedParty(test);
    const room = await startParty(test, { name: 'Movie night', source: { videoId: VIDEO_A } });
    const written = vi.spyOn(test.repositories.watchPartyRooms, 'setSearchText');

    await refreshSearchText(test.deps, {
      id: room.id,
      name: 'Film club',
      ownerKey: `user:${OWNER.id}`,
      currentVideoId: VIDEO_B,
    });

    expect(written).toHaveBeenCalledWith(room.id, 'Film club owner Olivia Owner Second');
  });

  it('writes the name alone for a room with no video and an owner with no channel', async () => {
    const test = watchPartyTestDeps();
    const written = vi.spyOn(test.repositories.watchPartyRooms, 'setSearchText');

    await refreshSearchText(test.deps, {
      id: '018f0000-0000-7000-8000-0000000000aa',
      name: 'Lobby',
      ownerKey: 'discord:123',
      currentVideoId: null,
    });

    expect(written).toHaveBeenCalledWith('018f0000-0000-7000-8000-0000000000aa', 'Lobby');
  });
});
