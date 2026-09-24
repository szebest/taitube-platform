import { ErrorCodes } from '@vp/errors';
import {
  ADMIN_TOKEN,
  type CategoriesApp,
  REGULAR_USER_ID,
  buildCategoriesApp,
  deleteCategory,
  patchCategory,
  postCategory,
} from './categories-app';

const FAKE_ID = '00000000-0000-7000-8000-000000000999';
const VIDEO_ID = '018f0000-0000-7000-8000-000000000099';

describe('admin category writes', () => {
  let ctx: CategoriesApp;

  beforeAll(async () => {
    ctx = await buildCategoriesApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.reset();
  });

  it.each([
    {
      method: 'POST' as const,
      url: '/v1/admin/categories',
      payload: { name: 'Test', slug: 'test' },
    },
    {
      method: 'PATCH' as const,
      url: '/v1/admin/categories/00000000-0000-7000-8000-000000000001',
      payload: { name: 'Test' },
    },
    {
      method: 'DELETE' as const,
      url: '/v1/admin/categories/00000000-0000-7000-8000-000000000001',
      payload: undefined,
    },
  ])('returns 401 for an unauthenticated $method', async ({ method, url, payload }) => {
    const res = await ctx.app.inject({ method, url, payload });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 Forbidden for non-admin users', async () => {
    const res = await postCategory(ctx.app, ctx.userJwt, { name: 'Test', slug: 'test' });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('accepts valid x-admin-token header for admin operations', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/admin/categories',
      headers: { 'x-admin-token': ADMIN_TOKEN },
      payload: { name: 'Admin Via Header', slug: 'admin-header' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Admin Via Header');
  });

  it('rejects an invalid slug with 400', async () => {
    const res = await postCategory(ctx.app, ctx.adminJwt, {
      name: 'Invalid Slug',
      slug: 'INVALID SLUG WITH SPACES AND CAPS!',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 CATEGORY_SLUG_CONFLICT on duplicate slug', async () => {
    await postCategory(ctx.app, ctx.adminJwt, { name: 'Gaming', slug: 'gaming' });

    const dupRes = await postCategory(ctx.app, ctx.adminJwt, {
      name: 'Gaming Duplicate',
      slug: 'gaming',
    });

    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().code).toBe(ErrorCodes.CATEGORY_SLUG_CONFLICT);
  });

  it('refuses to delete a category a live video uses and deletes it once the video is gone', async () => {
    const catId = (
      await postCategory(ctx.app, ctx.adminJwt, {
        name: 'Film & Animation',
        slug: 'film-animation',
      })
    ).json().id;
    await ctx.repositories.videos.create({
      id: VIDEO_ID,
      ownerId: REGULAR_USER_ID,
      title: 'Video in Film Category',
      status: 'READY',
      sourceKey: 'raw/99.mp4',
      categoryId: catId,
    });

    const delInUse = await deleteCategory(ctx.app, ctx.adminJwt, catId);
    expect(delInUse.statusCode).toBe(409);
    expect(delInUse.json().code).toBe(ErrorCodes.CATEGORY_IN_USE);

    await ctx.repositories.videos.transition({
      videoId: VIDEO_ID,
      from: 'READY',
      to: 'DELETED',
      eventType: 'video.deleted',
      patch: { deletedAt: new Date() },
    });

    const delSuccess = await deleteCategory(ctx.app, ctx.adminJwt, catId);
    expect(delSuccess.statusCode).toBe(204);

    const getAfter = await ctx.app.inject({ method: 'GET', url: '/v1/categories' });
    expect(getAfter.json()).toHaveLength(0);
  });

  it('returns 404 CATEGORY_NOT_FOUND when updating or deleting non-existent category', async () => {
    const patchRes = await patchCategory(ctx.app, ctx.adminJwt, FAKE_ID, { name: 'Ghost' });
    expect(patchRes.statusCode).toBe(404);
    expect(patchRes.json().code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);

    const delRes = await deleteCategory(ctx.app, ctx.adminJwt, FAKE_ID);
    expect(delRes.statusCode).toBe(404);
    expect(delRes.json().code).toBe(ErrorCodes.CATEGORY_NOT_FOUND);
  });
});
