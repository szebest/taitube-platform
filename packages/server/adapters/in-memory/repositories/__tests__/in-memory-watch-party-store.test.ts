import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS } from '../../../__tests__/contract/fixtures';
import {
  AT,
  itemId,
  lineAt,
  lineId,
  ROOM_ID,
  roomSeed,
} from '../../../__tests__/contract/watch-party-fixtures';
import { InMemoryWatchPartyRoomRepository } from '../in-memory-watch-party-room-repository';
import { InMemoryWatchPartyStore } from '../in-memory-watch-party-store';

const UNKNOWN_ROOM_ID = '00000000-0000-7000-8000-00000000e0ff';

async function seededStore() {
  const store = new InMemoryWatchPartyStore();
  const rooms = new InMemoryWatchPartyRoomRepository(store);
  expectOk(await rooms.create(roomSeed({ videoIds: [VIDEO_IDS.a, VIDEO_IDS.b] })));
  return store;
}

describe('InMemoryWatchPartyStore', () => {
  it('stores a system line with no author, carrying its event and place', async () => {
    const store = await seededStore();

    store.appendSystemLine(ROOM_ID, { ...lineAt(1), videoId: VIDEO_IDS.a, positionMs: 4_000 });

    expect(store.messages.get(lineId(1))).toMatchObject({
      roomId: ROOM_ID,
      authorKey: null,
      kind: 'system',
      system: { event: 'settings_changed' },
      videoId: VIDEO_IDS.a,
      positionMs: 4_000,
      createdAt: AT,
    });
  });

  it.each([
    { scenario: 'a room that exists', roomId: ROOM_ID, rolesVersion: 1 },
    { scenario: 'a room that is gone', roomId: UNKNOWN_ROOM_ID, rolesVersion: null },
  ])('bumps the roles version of $scenario', async ({ roomId, rolesVersion }) => {
    const store = await seededStore();

    expect(store.bumpRolesVersion(roomId, AT)).toBe(rolesVersion);
  });

  it('recounts the queue without removed items and bumps its version', async () => {
    const store = await seededStore();
    const removed = store.queue.get(itemId(2));
    if (removed) store.queue.set(removed.id, { ...removed, removedAt: AT });

    expect(store.bumpQueueVersion(ROOM_ID)).toBe(1);
    expect(store.rooms.get(ROOM_ID)).toMatchObject({ queueLength: 1, queueVersion: 1 });
    expect(store.bumpQueueVersion(UNKNOWN_ROOM_ID)).toBeNull();
  });

  it('empties every table', async () => {
    const store = await seededStore();

    store.clear();

    expect([store.rooms.size, store.roles.size, store.members.size, store.queue.size]).toEqual([
      0, 0, 0, 0,
    ]);
  });
});
