import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { VideoBulkEditService } from '../video-bulk-edit-service';
import { creatorStudioOf } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const OTHER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'CREATOR' };
const ids = [1, 2, 3].map((n) => `00000000-0000-7000-8000-0000000000e${n}`);
const [A, B, C] = ids as [string, string, string];
const MISSING = '00000000-0000-7000-8000-0000000000ff';

describe('apps/server/api/services: bulk edit', () => {
  let repositories: InMemoryRepositories;
  let bulk: VideoBulkEditService;

  const seed = async (id: string, overrides: Partial<NewVideoInput> = {}) =>
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        channelId: await seedPrimaryChannel(repositories, overrides.ownerId ?? OWNER.id),
        title: `Video ${id.slice(-1)}`,
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${id}.mp4`,
        ...overrides,
      })
    );

  const read = async (id: string) => expectOk(await repositories.videos.findById(id));

  beforeEach(() => {
    repositories = new InMemoryRepositories();
    bulk = new VideoBulkEditService({
      videos: repositories.videos,
      studio: creatorStudioOf(repositories),
    });
  });

  it('changes every video and reports each one', async () => {
    await seed(A);
    await seed(B);

    const { items } = expectOk(
      await bulk.edit(OWNER, { ids: [A, B], patch: { visibility: 'unlisted' } })
    );

    expect(items).toEqual([
      { id: A, ok: true },
      { id: B, ok: true },
    ]);
    expect((await read(A))?.visibility).toBe('unlisted');
    expect((await read(B))?.version).toBe(2);
  });

  it('fails one item without failing the batch', async () => {
    await seed(A);
    await seed(B, { ownerId: OTHER.id });

    const { items } = expectOk(
      await bulk.edit(OWNER, { ids: [A, B], patch: { commentsEnabled: false } })
    );

    expect(items[0]).toEqual({ id: A, ok: true });
    expect(items[1]).toMatchObject({ id: B, ok: false });
    expect((await read(B))?.commentsEnabled).toBe(true);
  });

  it.each([
    { name: 'a video that is not there', id: MISSING },
    { name: 'a private video of someone else, disguised as absent', id: B },
  ])('reports $name as VIDEO_NOT_FOUND', async ({ id }) => {
    await seed(B, { visibility: 'private' });

    const { items } = expectOk(
      await bulk.edit(OTHER, { ids: [id], patch: { commentsEnabled: false } })
    );

    expect(items).toEqual([{ id, ok: false, code: ErrorCodes.VIDEO_NOT_FOUND }]);
  });

  it('answers with every item, also when every one failed', async () => {
    const { items } = expectOk(
      await bulk.edit(OWNER, { ids: [MISSING], patch: { commentsEnabled: true } })
    );

    expect(items.every((item) => !item.ok)).toBe(true);
  });

  it('merges tags per video, each against its own current tags', async () => {
    await seed(A, { tags: ['a', 'b'] });
    await seed(B, { tags: ['b', 'c'] });
    await seed(C, { tags: [] });

    expectOk(
      await bulk.edit(OWNER, { ids: [A, B, C], patch: { addTags: ['new'], removeTags: ['b'] } })
    );

    expect([(await read(A))?.tags, (await read(B))?.tags, (await read(C))?.tags]).toEqual([
      ['a', 'new'],
      ['c', 'new'],
      ['new'],
    ]);
  });

  it('reports a category that does not exist for each item', async () => {
    await seed(A);

    const { items } = expectOk(
      await bulk.edit(OWNER, {
        ids: [A],
        patch: { categoryId: '00000000-0000-7000-8000-0000000000aa' },
      })
    );

    expect(items).toEqual([{ id: A, ok: false, code: ErrorCodes.CATEGORY_NOT_FOUND }]);
  });

  it('counts a repeated id once', async () => {
    await seed(A);

    const { items } = expectOk(
      await bulk.edit(OWNER, { ids: [A, A], patch: { commentsEnabled: false } })
    );

    expect(items).toHaveLength(1);
    expect((await read(A))?.version).toBe(2);
  });

  it.each([
    { name: 'no ids', input: { ids: [], patch: { commentsEnabled: true } } },
    { name: 'an empty patch', input: { ids: [A], patch: {} } },
  ])('refuses $name before touching anything', async ({ input }) => {
    expect(expectErr(await bulk.edit(OWNER, input)).code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
