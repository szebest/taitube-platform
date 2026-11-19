import { Paginator } from '@kit/pagination';
import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { VideoRevisionService } from '../video-revision-service';
import { creatorStudioOf } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000da';
const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 20_000, title: 'Middle' },
  { startMs: 60_000, title: 'End' },
];

describe('apps/server/api/services: video revisions', () => {
  let repositories: InMemoryRepositories;
  let revisions: VideoRevisionService;
  let studio: ReturnType<typeof creatorStudioOf>;

  const versionOf = async () =>
    expectOk(await repositories.videos.findById(VIDEO_ID))?.version ?? -1;
  const edit = async (
    patch: Parameters<typeof studio.update>[2] extends infer E
      ? Omit<NonNullable<E>, 'version'>
      : never
  ) => expectOk(await studio.update(OWNER, VIDEO_ID, { ...patch, version: await versionOf() }));
  const list = async (user = OWNER, query = {}) =>
    expectOk(await revisions.list(user, VIDEO_ID, query));

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    studio = creatorStudioOf(repositories);
    revisions = new VideoRevisionService({
      videos: repositories.videos,
      revisions: repositories.entityRevisions,
      chapters: repositories.videoChapters,
      studio,
      paginator: new Paginator(),
    });
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'Original',
        description: 'First words',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/a.mp4',
        durationMs: 120_000,
      })
    );
  });

  it('lists the history newest first, the state before the first edit included', async () => {
    await edit({ title: 'One' });
    await edit({ title: 'Two' });

    const { items, nextCursor } = await list();

    expect(items.map((item) => item.snapshot.title)).toEqual(['Two', 'One', 'Original']);
    expect(items.map((item) => item.version)).toEqual([3, 2, 1]);
    expect(items[0]).toMatchObject({ authorUserId: OWNER.id, restoredFromVersion: null });
    expect(nextCursor).toBeNull();
  });

  it('pages the history by version', async () => {
    await edit({ title: 'One' });
    await edit({ title: 'Two' });

    const first = await list(OWNER, { limit: 2 });
    const second = await list(OWNER, { limit: 2, cursor: first.nextCursor ?? undefined });

    expect(first.items.map((item) => item.version)).toEqual([3, 2]);
    expect(second.items.map((item) => item.version)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });

  it('restores an earlier state as a new revision, history intact', async () => {
    await edit({ title: 'One', description: 'Later words', chapters: CHAPTERS });
    const before = (await list()).items;
    const original = before.find((item) => item.snapshot.title === 'Original');

    const view = expectOk(
      await revisions.restore(OWNER, VIDEO_ID, original?.id ?? '', await versionOf())
    );

    expect(view).toMatchObject({ title: 'Original', description: 'First words', chapters: [] });
    const after = (await list()).items;
    expect(after.map((item) => item.version)).toEqual([3, 2, 1]);
    expect(after[0]).toMatchObject({ restoredFromVersion: 1, snapshot: { title: 'Original' } });
  });

  it('audits the restore beside the edit', async () => {
    const channel = expectOk(
      await repositories.channels.create({
        userId: OWNER.id,
        handle: 'owner',
        displayName: 'Owner',
      })
    );
    await edit({ title: 'One' });
    const original = (await list()).items.at(-1);

    expectOk(await revisions.restore(OWNER, VIDEO_ID, original?.id ?? '', await versionOf()));

    const log = expectOk(
      await repositories.channelAudit.list(channel.id, { cursor: null, limit: 10 })
    );
    expect(log.map((entry) => entry.action)).toContain('video.restored');
  });

  it('answers a restore made against a stale version with a conflict', async () => {
    await edit({ title: 'One' });
    const original = (await list()).items.at(-1);

    const failure = expectErr(
      await revisions.restore(OWNER, VIDEO_ID, original?.id ?? '', (await versionOf()) - 1)
    );

    expect(failure.code).toBe(ErrorCodes.VERSION_CONFLICT);
  });

  it('answers a revision that is not there', async () => {
    const failure = expectErr(
      await revisions.restore(
        OWNER,
        VIDEO_ID,
        '00000000-0000-7000-8000-0000000000aa',
        await versionOf()
      )
    );

    expect(failure.code).toBe(ErrorCodes.REVISION_NOT_FOUND);
  });

  it.each(['list', 'restore'] as const)('refuses a stranger on %s', async (action) => {
    const failure =
      action === 'list'
        ? expectErr(await revisions.list(STRANGER, VIDEO_ID, {}))
        : expectErr(await revisions.restore(STRANGER, VIDEO_ID, VIDEO_ID, 1));

    expect(failure.code).toBe(ErrorCodes.FORBIDDEN);
  });

  it('refuses a cursor it did not mint', async () => {
    expect(expectErr(await revisions.list(OWNER, VIDEO_ID, { cursor: 'nope' })).code).toBe(
      ErrorCodes.INVALID_CURSOR
    );
  });
});
