import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { TOKENS, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const VIDEO_ID = '44444444-4444-7444-8444-444444444441';
const POPULAR_ID = '44444444-4444-7444-8444-444444444442';
const FOREIGN_ID = '44444444-4444-7444-8444-444444444443';
const CATEGORY_ID = '44444444-4444-7444-8444-444444444444';

describe('creator studio video routes', () => {
  let app: FastifyInstance;
  let repositories: InMemoryRepositories;

  const versionOf = async (videoId: string) =>
    expectOk(await repositories.videos.findById(videoId))?.version ?? -1;

  const patch = (payload: object, token = TOKENS.user, videoId = VIDEO_ID) =>
    app.inject({
      method: 'PATCH',
      url: `/v1/creator/videos/${videoId}`,
      headers: bearer(token),
      payload,
    });

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    repositories.clear();
    await seedVideo(repositories, {
      id: VIDEO_ID,
      ownerId: SEEDED.userId,
      title: 'Mine',
      commentsCount: 2,
    });
    await seedVideo(repositories, {
      id: POPULAR_ID,
      ownerId: SEEDED.userId,
      title: 'Popular',
      visibility: 'private',
      viewsCount: 90,
    });
    await seedVideo(repositories, {
      id: FOREIGN_ID,
      ownerId: SEEDED.otherUserId,
      title: 'Theirs',
    });
    expectOk(
      await repositories.categories.create({ id: CATEGORY_ID, slug: 'music', name: 'Music' })
    );
  });

  describe('GET /v1/creator/videos', () => {
    it('lists the caller library in the chosen sort with its counters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/creator/videos?sort=views',
        headers: bearer(TOKENS.user),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([
        POPULAR_ID,
        VIDEO_ID,
      ]);
      expect(res.json().items[1]).toMatchObject({ commentsCount: 2, tags: [], status: 'READY' });
    });

    it('filters by visibility', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/creator/videos?visibility=private',
        headers: bearer(TOKENS.user),
      });

      expect(res.json().items.map((item: { id: string }) => item.id)).toEqual([POPULAR_ID]);
    });

    it('refuses an anonymous caller with 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/creator/videos' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /v1/creator/videos/:id', () => {
    it('updates the metadata, tags, category and thumbnail in one versioned edit', async () => {
      const version = await versionOf(VIDEO_ID);

      const res = await patch({
        title: 'Retitled',
        tags: ['lofi', 'study'],
        categoryId: CATEGORY_ID,
        selectedThumbnail: { source: 'poster' },
        visibility: 'unlisted',
        version,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        title: 'Retitled',
        tags: ['lofi', 'study'],
        categoryId: CATEGORY_ID,
        visibility: 'unlisted',
        version: version + 1,
      });
    });

    it('answers the second of two edits made against the same version with 409', async () => {
      const version = await versionOf(VIDEO_ID);

      const first = await patch({ title: 'First', version });
      const second = await patch({ title: 'Second', version });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
      expect(second.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
    });

    it.each([
      {
        name: 'more than 30 tags',
        payload: { tags: Array.from({ length: 31 }, (_, i) => `t${i}`) },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a tag longer than 30 characters',
        payload: { tags: ['a'.repeat(31)] },
        status: 422,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a category that does not exist',
        payload: { categoryId: '44444444-4444-7444-8444-444444444449' },
        status: 404,
        code: ErrorCodes.CATEGORY_NOT_FOUND,
      },
    ])('refuses $name with $status', async ({ payload, status, code }) => {
      const res = await patch({ ...payload, version: await versionOf(VIDEO_ID) });

      expect(res.statusCode).toBe(status);
      expect(res.json().code).toBe(code);
    });

    it.each([
      { name: 'a public video they do not own', videoId: VIDEO_ID, status: 403 },
      { name: 'a private video they cannot see', videoId: POPULAR_ID, status: 404 },
    ])("answers a stranger's edit of $name with $status", async ({ videoId, status }) => {
      const version = await versionOf(videoId);

      const res = await patch({ title: 'Hijack', version }, TOKENS.otherUser, videoId);

      expect(res.statusCode).toBe(status);
    });

    it('lets an admin edit any video', async () => {
      const res = await patch(
        { title: 'Moderated', version: await versionOf(FOREIGN_ID) },
        TOKENS.admin,
        FOREIGN_ID
      );

      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Moderated');
    });
  });

  describe('DELETE /v1/creator/videos/:id', () => {
    it('soft-deletes the video, records it and drops it from the library', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/creator/videos/${VIDEO_ID}`,
        headers: bearer(TOKENS.user),
      });

      expect(res.statusCode).toBe(202);
      expect(res.json()).toEqual({ videoId: VIDEO_ID, status: 'DELETED' });
      const stored = expectOk(await repositories.videos.findById(VIDEO_ID));
      expect(stored?.deletedAt).toBeInstanceOf(Date);
      const events = expectOk(await repositories.events.findByVideoId(VIDEO_ID));
      expect(events.map((event) => event.type)).toContain('video.deleted');

      const library = await app.inject({
        method: 'GET',
        url: '/v1/creator/videos',
        headers: bearer(TOKENS.user),
      });
      expect(library.json().items.map((item: { id: string }) => item.id)).toEqual([POPULAR_ID]);
    });

    it("refuses to delete someone else's video with 403", async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/creator/videos/${FOREIGN_ID}`,
        headers: bearer(TOKENS.user),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
