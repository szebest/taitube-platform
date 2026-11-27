import { expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { commentWithHost } from '../comment-lookup';

const OWNER = '11111111-1111-7111-8111-111111111111';
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';
const COMMENT_ID = '44444444-4444-7444-8444-444444444444';

describe('apps/server/api/services: comment lookup', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER,
      channelId: await seedPrimaryChannel(repositories, OWNER),
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      visibility: 'public',
      status: 'READY',
    });
    await repositories.comments.create({
      id: COMMENT_ID,
      target: { type: 'video', id: VIDEO_ID },
      channelId: await seedPrimaryChannel(repositories, OWNER),
      authorId: OWNER,
      authorChannelId: await seedPrimaryChannel(repositories, OWNER),
      parentId: null,
      content: 'hello',
    });
  });

  const lookup = () =>
    commentWithHost(
      {
        comments: repositories.comments,
        videos: repositories.videos,
        posts: repositories.channelPosts,
        channels: repositories.channels,
      },
      COMMENT_ID
    );

  it('finds a live comment with the video it sits under', async () => {
    const found = expectOk(await lookup());

    expect(found.comment?.id).toBe(COMMENT_ID);
    expect(found.host?.type === 'video' && found.host.video.id).toBe(VIDEO_ID);
  });

  it('finds neither once the comment is removed or was never there', async () => {
    await repositories.comments.remove({ id: COMMENT_ID, target: { type: 'video', id: VIDEO_ID } });

    expect(expectOk(await lookup())).toEqual({
      comment: null,
      host: null,
    });
  });
});
