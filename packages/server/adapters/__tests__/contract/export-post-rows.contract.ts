import { MS_PER_DAY } from '@kit/primitives';
import { expectOk } from '@kit/testing/result';
import type { ExportScope } from '@vp/core/repositories';
import { walk } from './export-row-walk';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  seedOwners,
} from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const POST = (n: number) => `00000000-0000-7000-8000-00000000ed${String(n).padStart(2, '0')}`;
const BASE = Date.parse('2026-03-01T12:00:00.000Z');
const SCOPE: ExportScope = { channelId: OWNER_CHANNEL_ID, ownerId: OWNER_ID, range: {} };

export function describeExportPostRowsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('posts', () => {
    let subject: RepositoriesSubject;

    const publish = async (n: number, channelId: string, authorUserId: string, createdAt: Date) => {
      const id = POST(n);
      expectOk(
        await subject.repositories.channelPosts.publish(
          {
            id,
            channelId,
            authorUserId,
            payload: { kind: 'text', text: `Post ${n}` },
            commentsEnabled: n !== 2,
          },
          {
            channelId,
            actorUserId: authorUserId,
            action: 'post.published',
            targetType: 'post',
            targetId: id,
            meta: { kind: 'text' },
          }
        )
      );
      await subject.backdatePost(id, createdAt);
    };

    const read = (scope: ExportScope) =>
      walk(subject.repositories.exportRows.posts.bind(subject.repositories.exportRows), scope);

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await publish(1, OWNER_CHANNEL_ID, OWNER_ID, new Date(BASE));
      await publish(2, OWNER_CHANNEL_ID, OWNER_ID, new Date(BASE + 1000));
      await publish(3, OWNER_CHANNEL_ID, OWNER_ID, new Date(BASE + 2 * MS_PER_DAY));
      await publish(4, OTHER_OWNER_CHANNEL_ID, OTHER_OWNER_ID, new Date(BASE + 3000));
    });

    it('reads the channel posts oldest first with their payload as JSON text and their counts', async () => {
      const rows = await read(SCOPE);

      expect(rows.map(({ postId }) => postId)).toEqual([POST(1), POST(2), POST(3)]);
      expect(rows[1]).toMatchObject({
        kind: 'text',
        status: 'published',
        payload: JSON.stringify({ kind: 'text', text: 'Post 2' }),
        commentsEnabled: false,
        likeCount: 0,
        commentsCount: 0,
        createdAt: new Date(BASE + 1000).toISOString(),
        editedAt: null,
      });
      expect(rows[1]?.publishedAt).toEqual(expect.any(String));
    });

    it('narrows the posts to those made on the days of the range', async () => {
      const rows = await read({ ...SCOPE, range: { from: '2026-03-03' } });

      expect(rows.map(({ postId }) => postId)).toEqual([POST(3)]);
    });
  });
}
