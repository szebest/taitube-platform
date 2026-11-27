import { expectOk } from '@kit/testing/result';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { SEEDED } from '@vp/testing-fixtures';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedTeamMember, seedVideo } from '../../__tests__/test-app';

const VIDEO_ID = '44444444-4444-7444-8444-444444444441';

describe('deleting a video as a member of the owner channel team', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const deleteAs = async (role: 'editor' | 'moderator', base: string) => {
    await seedTeamMember(repositories, {
      ownerId: SEEDED.userId,
      memberId: SEEDED.otherUserId,
      role,
    });
    return app.inject({
      method: 'DELETE',
      url: `${base}/${VIDEO_ID}`,
      headers: bearer(TOKENS.otherUser),
    });
  };

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    await seedVideo(repositories, { id: VIDEO_ID, ownerId: SEEDED.userId, title: 'Mine' });
  });

  it.each(
    (['editor', 'moderator'] as const).flatMap((role) =>
      ['/v1/creator/videos', '/v1/videos'].map((base) => ({ role, base }))
    )
  )('refuses a $role the delete on $base and keeps the video', async ({ role, base }) => {
    const res = await deleteAs(role, base);

    expect(res.statusCode).toBe(403);
    expect(expectOk(await repositories.videos.findById(VIDEO_ID))?.deletedAt).toBeFalsy();
  });
});
