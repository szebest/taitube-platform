import { expectOk } from '@kit/testing/result';
import { mintToken } from '@vp/dev-identity';
import { ErrorCodes } from '@vp/errors';
import { type TestApp, bearer, buildTestApp, seedVideo } from '../../__tests__/test-app';

const OWNER = '11111111-1111-7111-8111-111111111111';
const STRANGER = '44444444-4444-7444-8444-444444444444';
const CATEGORY = '55555555-5555-7555-8555-555555555555';
const OWN_COUNT = 29;
const idOf = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const OWN = Array.from({ length: OWN_COUNT }, (_, n) => idOf(n + 1));
const FOREIGN = idOf(900);

const PATCH = {
  visibility: 'unlisted',
  categoryId: CATEGORY,
  addTags: ['summer'],
  removeTags: ['draft'],
  commentsEnabled: false,
};

describe('video bulk edit history', () => {
  let ctx: TestApp;
  const headers = bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' }));

  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    ctx.app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  const history = async (id: string) =>
    (await call('GET', `/v1/creator/videos/${id}/revisions`)).json().items;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.repositories.clear();
    ctx.cache.clear();
    expectOk(
      await ctx.repositories.categories.create({ id: CATEGORY, slug: 'music', name: 'Music' })
    );
    for (const id of OWN) {
      await seedVideo(ctx.repositories, { id, ownerId: OWNER, title: id, tags: ['draft', 'keep'] });
    }
    await seedVideo(ctx.repositories, { id: FOREIGN, ownerId: STRANGER, title: 'Theirs' });
  });

  it('records the change in each changed video history, restorable, and refuses a stale restore', async () => {
    const res = await call('POST', '/v1/creator/videos/bulk', {
      ids: [...OWN, FOREIGN],
      patch: PATCH,
    });

    const items: { id: string; ok: boolean }[] = res.json().items;
    expect(items.filter((item) => item.ok)).toHaveLength(OWN_COUNT);
    expect(items.filter((item) => !item.ok).map((item) => item.id)).toEqual([FOREIGN]);
    for (const id of OWN) {
      expect((await history(id))[0]).toMatchObject({
        version: 2,
        snapshot: {
          visibility: 'unlisted',
          categoryId: CATEGORY,
          tags: ['keep', 'summer'],
          commentsEnabled: false,
        },
      });
    }

    const [id] = OWN as [string];
    const before = (await history(id)).at(-1);
    const stale = await call('POST', `/v1/creator/videos/${id}/revisions/${before.id}/restore`, {
      version: 1,
    });
    const restored = await call('POST', `/v1/creator/videos/${id}/revisions/${before.id}/restore`, {
      version: 2,
    });

    expect(stale.json().code).toBe(ErrorCodes.VERSION_CONFLICT);
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ visibility: 'public', commentsEnabled: true });
  });
});
