import type { NewWatchPartyMessage } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import {
  accountId,
  AT,
  createRoom,
  numberedId,
  OTHER_ROOM_ID,
  ROOM_ID,
  seedRoomWorld,
  userKey,
} from './watch-party-activity-fixtures';

const messageId = (n: number) => numberedId(9, n);

function text(n: number, overrides: Partial<NewWatchPartyMessage> = {}): NewWatchPartyMessage {
  return {
    id: messageId(n),
    roomId: ROOM_ID,
    authorKey: userKey(accountId(3)),
    source: 'app',
    kind: 'text',
    body: `line ${n}`,
    system: null,
    videoId: null,
    positionMs: null,
    createdAt: new Date(AT.getTime() + n * 1_000),
    ...overrides,
  };
}

const systemLine = (n: number): NewWatchPartyMessage =>
  text(n, {
    authorKey: null,
    kind: 'system',
    body: '',
    system: { event: 'joined', actorKey: userKey(accountId(3)), targetKey: null, detail: null },
    videoId: VIDEO_IDS.a,
    positionMs: 4_000,
  });

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function describeWatchPartyMessageRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('WatchPartyMessageRepository contract', () => {
    let subject: RepositoriesSubject;

    const messages = () => subject.repositories.watchPartyMessages;
    const appendAll = async (lines: NewWatchPartyMessage[]) => {
      for (const line of lines) expectOk(await messages().append(line));
    };

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

    it.each([
      { kind: 'a chat line from another client', message: text(1, { source: 'discord' }) },
      { kind: 'a system line with where the room was', message: systemLine(2) },
    ])('stores $kind unpinned and answers the stored record', async ({ message }) => {
      const stored = expectOk(await messages().append(message));

      expect(stored).toEqual({ ...message, pinned: false, removedAt: null });
      expect(expectOk(await messages().listAfter(ROOM_ID, null, 10))).toEqual([stored]);
    });

    it.each([
      { scenario: 'the newest lines, with no cursor', after: null, ids: [4, 5] },
      { scenario: 'the lines after a cursor, system lines among them', after: 1, ids: [3, 4] },
      { scenario: 'nothing after the last line', after: 5, ids: [] },
    ])('lists $scenario, oldest first and without removed lines', async ({ after, ids }) => {
      await appendAll([text(1), text(2), systemLine(3), text(4), text(5)]);
      expectOk(await messages().remove(ROOM_ID, messageId(2), AT));

      const page = expectOk(
        await messages().listAfter(ROOM_ID, after === null ? null : messageId(after), 2)
      );

      expect(idsOf(page)).toEqual(ids.map(messageId));
    });

    it("reads one room's lines only", async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await appendAll([text(1), text(2, { roomId: OTHER_ROOM_ID })]);

      expect(idsOf(expectOk(await messages().listAfter(ROOM_ID, null, 10)))).toEqual([
        messageId(1),
      ]);
    });

    it('lists the lines removed since a cursor was sent, and not the ones removed before', async () => {
      await appendAll([text(1), text(2), text(3)]);
      expectOk(await messages().remove(ROOM_ID, messageId(1), new Date(AT.getTime() + 500)));
      expectOk(await messages().remove(ROOM_ID, messageId(2), new Date(AT.getTime() + 2_500)));
      expectOk(await messages().remove(ROOM_ID, messageId(3), new Date(AT.getTime() + 3_500)));

      const removed = expectOk(await messages().listRemovedSince(ROOM_ID, messageId(2), 10));

      expect(removed).toEqual([messageId(2), messageId(3)]);
    });

    it('finds a live line of the room, and none that is removed or another room’s', async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await appendAll([text(1), text(2), text(3, { roomId: OTHER_ROOM_ID })]);
      expectOk(await messages().remove(ROOM_ID, messageId(2), AT));

      expect(expectOk(await messages().find(ROOM_ID, messageId(1)))).toMatchObject({
        id: messageId(1),
        authorKey: userKey(accountId(3)),
      });
      expect(expectOk(await messages().find(ROOM_ID, messageId(2)))).toBeNull();
      expect(expectOk(await messages().find(ROOM_ID, messageId(3)))).toBeNull();
    });

    it('removes a line of the room once', async () => {
      await createRoom(subject, OTHER_ROOM_ID);
      await appendAll([text(1), text(2, { roomId: OTHER_ROOM_ID })]);

      expect(expectOk(await messages().remove(ROOM_ID, messageId(2), AT))).toBe(false);
      expect(expectOk(await messages().remove(ROOM_ID, messageId(9), AT))).toBe(false);
      expect(expectOk(await messages().remove(ROOM_ID, messageId(1), AT))).toBe(true);
      expect(expectOk(await messages().remove(ROOM_ID, messageId(1), AT))).toBe(false);
    });

    it('pins one line at a time and unpins on null', async () => {
      await appendAll([text(1), text(2)]);

      const first = expectOk(await messages().pin(ROOM_ID, messageId(1)));
      const second = expectOk(await messages().pin(ROOM_ID, messageId(2)));
      const listed = expectOk(await messages().listAfter(ROOM_ID, null, 10));

      expect(first).toMatchObject({ id: messageId(1), pinned: true });
      expect(second).toMatchObject({ id: messageId(2), pinned: true });
      expect(listed.map((line) => line.pinned)).toEqual([false, true]);
      expect(expectOk(await messages().findPinned(ROOM_ID))).toEqual(second);
      expect(expectOk(await messages().pin(ROOM_ID, null))).toBeNull();
      expect(expectOk(await messages().findPinned(ROOM_ID))).toBeNull();
    });

    it.each([
      { scenario: 'a system line', target: 3 },
      { scenario: 'a removed line', target: 4 },
      { scenario: 'another room line', target: 5 },
      { scenario: 'a line that is not there', target: 9 },
    ])('answers null and unpins when asked to pin $scenario', async ({ target }) => {
      await createRoom(subject, OTHER_ROOM_ID);
      await appendAll([
        text(1),
        text(2),
        systemLine(3),
        text(4),
        text(5, { roomId: OTHER_ROOM_ID }),
      ]);
      expectOk(await messages().remove(ROOM_ID, messageId(4), AT));
      expectOk(await messages().pin(ROOM_ID, messageId(1)));

      expect(expectOk(await messages().pin(ROOM_ID, messageId(target)))).toBeNull();
      expect(expectOk(await messages().findPinned(ROOM_ID))).toBeNull();
    });

    it('does not read a removed pinned line as pinned', async () => {
      await appendAll([text(1)]);
      expectOk(await messages().pin(ROOM_ID, messageId(1)));
      expectOk(await messages().remove(ROOM_ID, messageId(1), AT));

      expect(expectOk(await messages().findPinned(ROOM_ID))).toBeNull();
    });
  });
}
