import { expectOk } from '@kit/testing/result';
import { listAuthored } from '../comment-authored';
import { newStoredComment } from '../comment-projections';
import { InMemoryRepositories } from '../in-memory-repositories';

const OWNER = '00000000-0000-7000-8000-000000000101';
const AUTHOR = { id: '00000000-0000-7000-8000-000000000102', role: 'USER' as const };
const VIDEO = '00000000-0000-7000-8000-00000000000a';

const stored = (id: string, authorId: string, at: number, deleted = false) => ({
  ...newStoredComment(
    {
      id,
      target: { type: 'video', id: VIDEO },
      channelId: 'channel-owner',
      authorId,
      authorChannelId: `channel-${authorId}`,
      parentId: null,
      content: id,
    },
    new Date(at)
  ),
  deletedAt: deleted ? new Date(at) : null,
});

describe('adapters/in-memory: comments by their author', () => {
  it("lists the viewer's own comments newest first and nobody else's", async () => {
    const repositories = new InMemoryRepositories();
    expectOk(
      await repositories.videos.create({
        id: VIDEO,
        ownerId: OWNER,
        channelId: 'owner-channel',
        sourceKey: 'raw/a/source.mp4',
        visibility: 'public',
        status: 'READY',
      })
    );
    const lookups = { videosRepo: repositories.videos, channelsRepo: repositories.channels };

    const listed = await listAuthored(
      lookups,
      [stored('old', AUTHOR.id, 1), stored('new', AUTHOR.id, 2), stored('other', OWNER, 3)],
      AUTHOR,
      { cursor: null, limit: 10 }
    );

    expect(listed.map(({ id }) => id)).toEqual(['new', 'old']);
  });
});
