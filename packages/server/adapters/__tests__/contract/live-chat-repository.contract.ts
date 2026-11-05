import type { LiveChatRepositoryPort } from '@vp/core/repositories';
import type { NewLiveChatMessage } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const STREAM_ID = '00000000-0000-7000-8000-00000000f301';
const AT = new Date('2026-03-01T12:00:00.000Z');

const messageId = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

function line(n: number, offsetMs: number, userId = OTHER_OWNER_ID): NewLiveChatMessage {
  return {
    id: messageId(n),
    liveStreamId: STREAM_ID,
    userId,
    message: `line ${n}`,
    offsetMs,
    createdAt: new Date(AT.getTime() + offsetMs),
  };
}

const idsOf = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

export function describeLiveChatRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('LiveChatRepository contract', () => {
    let subject: RepositoriesSubject;
    let chat: LiveChatRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      const channel = expectOk(
        await subject.repositories.channels.create({
          userId: OWNER_ID,
          handle: 'owner',
          displayName: 'The Owner',
        })
      );
      expectOk(
        await subject.repositories.liveStreams.ensureIdle(channel.id, {
          id: STREAM_ID,
          streamKey: 'chat-key',
          overlayToken: 'chat-overlay',
          controlToken: 'chat-control',
        })
      );
      chat = subject.repositories.liveChat;
    });

    it("appends a line with its author's channel, and no channel reads as null", async () => {
      const owned = expectOk(await chat.append(line(1, 0, OWNER_ID)));
      const plain = expectOk(await chat.append(line(2, 10)));

      expect(owned).toMatchObject({
        id: messageId(1),
        message: 'line 1',
        author: { userId: OWNER_ID, handle: 'owner', displayName: 'The Owner' },
      });
      expect(plain.author).toEqual({
        userId: OTHER_OWNER_ID,
        handle: null,
        displayName: null,
        avatarUrl: null,
      });
    });

    it.each([
      { scenario: 'the newest lines, with no cursor', after: null, ids: [3, 4] },
      { scenario: 'the lines after a cursor', after: 1, ids: [2, 3] },
      { scenario: 'nothing after the last line', after: 4, ids: [] },
    ])('lists $scenario, oldest first', async ({ after, ids }) => {
      for (const n of [1, 2, 3, 4]) expectOk(await chat.append(line(n, n * 100)));

      const page = expectOk(
        await chat.listAfter(STREAM_ID, after === null ? null : messageId(after), 2)
      );

      expect(idsOf(page)).toEqual(ids.map(messageId));
    });

    it('replays a half-open offset range in offset order', async () => {
      for (const [n, offset] of [
        [1, 3_000],
        [2, 1_000],
        [3, 2_000],
        [4, 4_000],
      ] as const)
        expectOk(await chat.append(line(n, offset)));

      const range = expectOk(
        await chat.listByOffset(STREAM_ID, { fromMs: 1_000, toMs: 4_000, limit: 10 })
      );

      expect(idsOf(range)).toEqual([2, 3, 1].map(messageId));
    });

    it('removes a line once, and every read leaves it out', async () => {
      for (const n of [1, 2]) expectOk(await chat.append(line(n, n)));

      expect(expectOk(await chat.remove(STREAM_ID, messageId(1), AT))).toBe(true);
      expect(expectOk(await chat.remove(STREAM_ID, messageId(1), AT))).toBe(false);
      expect(idsOf(expectOk(await chat.listAfter(STREAM_ID, null, 10)))).toEqual([messageId(2)]);
      expect(
        idsOf(expectOk(await chat.listByOffset(STREAM_ID, { fromMs: 0, toMs: 10, limit: 10 })))
      ).toEqual([messageId(2)]);
    });
  });
}
