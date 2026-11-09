import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { createComment } from '../comment-create';

const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
const VIEWER: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };
const VIDEO_ID = '33333333-3333-7333-8333-333333333333';
const MISSING_ID = '44444444-4444-7444-8444-444444444444';

describe('apps/server/api/services: create comment', () => {
  let repositories: InMemoryRepositories;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        visibility: 'public',
        status: 'READY',
      })
    );
  });

  it('stores the comment and answers its view', async () => {
    const view = expectOk(await createComment(repositories, VIEWER, VIDEO_ID, { content: 'hi' }));

    expect(view).toMatchObject({ content: 'hi', parentId: null });
    expect(expectOk(await repositories.comments.findById(view.id))?.authorId).toBe(VIEWER.id);
  });

  it.each([
    { scenario: 'a video that is not there', videoId: MISSING_ID, parentId: undefined },
    { scenario: 'a parent that is not there', videoId: VIDEO_ID, parentId: MISSING_ID },
  ])('refuses $scenario', async ({ videoId, parentId }) => {
    const failure = expectErr(
      await createComment(repositories, VIEWER, videoId, { content: 'hi', parentId })
    );

    expect([ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.COMMENT_NOT_FOUND]).toContain(failure.code);
  });
});
