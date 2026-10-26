import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { expectOk } from '@vp/testing/result';
import { commentWithVideo } from '../comment-lookup';

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
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      visibility: 'public',
      status: 'READY',
    });
    await repositories.comments.create({
      id: COMMENT_ID,
      videoId: VIDEO_ID,
      authorId: OWNER,
      parentId: null,
      content: 'hello',
    });
  });

  it('finds a live comment with the video it sits under', async () => {
    const found = expectOk(await commentWithVideo(repositories, COMMENT_ID));

    expect(found.comment?.id).toBe(COMMENT_ID);
    expect(found.video?.id).toBe(VIDEO_ID);
  });

  it('finds neither once the comment is removed or was never there', async () => {
    await repositories.comments.remove({ id: COMMENT_ID, videoId: VIDEO_ID });

    expect(expectOk(await commentWithVideo(repositories, COMMENT_ID))).toEqual({
      comment: null,
      video: null,
    });
  });
});
