import type { NewWatchPartyQueueItem, QueueWrite } from '@vp/core/repositories';
import { lobbyPlayback, type WatchPartyQueueItem } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  MINUTE_MS,
  numberedId,
  ROOM_ID,
  seedRoomWorld,
  userKey,
} from './watch-party-activity-fixtures';

const MAX_POSITION = 2 ** 31 - 1;
const UNKNOWN_ROOM_ID = '00000000-0000-7000-8000-00000000dfff';

const itemId = (n: number) => numberedId(7, n);

function item(n: number, overrides: Partial<NewWatchPartyQueueItem> = {}): NewWatchPartyQueueItem {
  return {
    id: itemId(n),
    roomId: ROOM_ID,
    videoId: VIDEO_IDS.a,
    addedBy: userKey(accountId(3)),
    startMs: 0,
    createdAt: new Date(AT.getTime() + n * MINUTE_MS),
    ...overrides,
  };
}

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const positionsOf = (rows: readonly WatchPartyQueueItem[]) => rows.map((row) => row.position);

function snapshotOf(write: QueueWrite) {
  if (write.type !== 'applied') throw new Error(`expected an applied write, got ${write.type}`);
  return write.queue;
}

export function describeWatchPartyQueueRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyQueueRepository contract', () => {
    let subject: RepositoriesSubject;

    const queue = () => subject.repositories.watchPartyQueue;
    const room = async () => {
      const found = expectOk(await subject.repositories.watchPartyRooms.findById(ROOM_ID));
      if (!found) throw new Error('the seeded room is gone');
      return found;
    };
    const append = async (ns: number[], limit = 200) =>
      snapshotOf(
        expectOk(
          await queue().append(
            ROOM_ID,
            ns.map((n) => item(n)),
            limit
          )
        )
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedRoomWorld(subject);
    });

    it('reads an unknown room as an empty queue at version 0', async () => {
      expect(expectOk(await queue().list(UNKNOWN_ROOM_ID))).toEqual({ items: [], version: 0 });
    });

    it('appends after the last item and moves the room version and length with it', async () => {
      const first = await append([1]);
      const second = await append([2, 3]);

      expect(positionsOf(first.items)).toEqual([0]);
      expect(positionsOf(second.items)).toEqual([0, 1024, 2048]);
      expect(idsOf(second.items)).toEqual([1, 2, 3].map(itemId));
      expect(second.items[2]).toEqual({
        ...item(3),
        position: 2048,
        playedAt: null,
        removedAt: null,
      });
      expect(expectOk(await queue().list(ROOM_ID))).toEqual(second);
      expect(await room()).toMatchObject({ queueVersion: 2, queueLength: 3 });
      expect([first.version, second.version]).toEqual([1, 2]);
    });

    it('renumbers the existing order before it appends past the position range', async () => {
      await append([1, 2]);
      expectOk(await queue().move(ROOM_ID, [{ id: itemId(2), position: MAX_POSITION }]));

      const appended = await append([3]);

      expect(idsOf(appended.items)).toEqual([1, 2, 3].map(itemId));
      expect(positionsOf(appended.items)).toEqual([0, 1024, 2048]);
    });

    it.each([
      { scenario: 'room for the whole batch', existing: 1, adding: 2, limit: 3, type: 'applied' },
      { scenario: 'one more than the limit', existing: 2, adding: 2, limit: 3, type: 'full' },
      { scenario: 'a batch past an empty queue', existing: 0, adding: 3, limit: 2, type: 'full' },
    ])('refuses a batch whole when it passes the limit: $scenario', async (row) => {
      await append(Array.from({ length: row.existing }, (_, n) => n + 1));
      const before = await room();

      const write = expectOk(
        await queue().append(
          ROOM_ID,
          Array.from({ length: row.adding }, (_, n) => item(n + 10)),
          row.limit
        )
      );

      expect(write.type).toBe(row.type);
      const expectedItems = row.type === 'applied' ? row.existing + row.adding : row.existing;
      expect(expectOk(await queue().list(ROOM_ID)).items).toHaveLength(expectedItems);
      expect((await room()).queueVersion).toBe(
        before.queueVersion + (row.type === 'applied' ? 1 : 0)
      );
    });

    it('counts neither played nor removed items against the limit', async () => {
      await append([1, 2, 3]);
      const { rolesVersion, playbackVersion } = await room();
      expectOk(
        await subject.repositories.watchPartyRooms.commitPlayback(ROOM_ID, {
          expected: { playbackVersion, rolesVersion },
          playback: lobbyPlayback(itemId(2)),
          playedItemId: itemId(1),
          line: null,
          at: AT,
        })
      );
      expectOk(await queue().remove(ROOM_ID, itemId(2), null, AT));

      const write = expectOk(await queue().append(ROOM_ID, [item(4), item(5)], 3));

      expect(write.type).toBe('applied');
      expect(idsOf(snapshotOf(write).items)).toEqual([1, 3, 4, 5].map(itemId));
    });

    it('applies the position writes and answers the new order', async () => {
      await append([1, 2, 3]);

      const moved = snapshotOf(
        expectOk(await queue().move(ROOM_ID, [{ id: itemId(3), position: -1 }]))
      );

      expect(idsOf(moved.items)).toEqual([3, 1, 2].map(itemId));
      expect(expectOk(await queue().list(ROOM_ID))).toEqual(moved);
      expect(await room()).toMatchObject({ queueVersion: 2, queueLength: 3 });
    });

    it.each([
      { name: 'append', write: () => queue().append(UNKNOWN_ROOM_ID, [item(1)], 10) },
      { name: 'move', write: () => queue().move(UNKNOWN_ROOM_ID, []) },
      { name: 'remove', write: () => queue().remove(UNKNOWN_ROOM_ID, itemId(1), null, AT) },
    ])('answers missing for $name on a room that is gone', async ({ write }) => {
      expect(expectOk(await write())).toEqual({ type: 'missing' });
    });

    it('removes an item once, writes its line with it and leaves it out of the queue', async () => {
      await append([1, 2]);
      const line = {
        id: numberedId(8, 1),
        line: { event: 'message_removed', actorKey: null, targetKey: null, detail: null },
        videoId: null,
        positionMs: null,
        createdAt: AT,
      } as const;

      const removed = snapshotOf(expectOk(await queue().remove(ROOM_ID, itemId(1), line, AT)));
      const again = expectOk(await queue().remove(ROOM_ID, itemId(1), null, AT));

      expect(idsOf(removed.items)).toEqual([itemId(2)]);
      expect(again).toEqual({ type: 'missing' });
      expect(await room()).toMatchObject({ queueVersion: 2, queueLength: 1 });
      const lines = expectOk(
        await subject.repositories.watchPartyMessages.listAfter(ROOM_ID, null, 10)
      );
      expect(idsOf(lines)).toEqual([line.id]);
    });

    it('writes nothing for an item that is not there', async () => {
      await append([1]);

      expect(expectOk(await queue().remove(ROOM_ID, itemId(9), null, AT))).toEqual({
        type: 'missing',
      });
      expect((await room()).queueVersion).toBe(1);
    });

    it('counts the unplayed, unremoved items one member added', async () => {
      const [ana, tom] = [userKey(accountId(3)), userKey(accountId(4))];
      await append([1, 2, 3]);
      expectOk(
        await queue().append(ROOM_ID, [item(4, { addedBy: tom }), item(5, { addedBy: tom })], 10)
      );
      expectOk(await queue().remove(ROOM_ID, itemId(3), null, AT));

      expect(expectOk(await queue().countPendingBy(ROOM_ID, ana))).toBe(2);
      expect(expectOk(await queue().countPendingBy(ROOM_ID, tom))).toBe(2);
      expect(expectOk(await queue().countPendingBy(ROOM_ID, userKey(accountId(5))))).toBe(0);
    });
  });
}
