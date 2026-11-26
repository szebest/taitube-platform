import { expectErr, expectOk } from '@kit/testing/result';
import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { seedPrimaryChannel } from '../../__tests__/test-app';
import { applyVideoEdit } from '../video-edit';
import { VideoService } from '../video-service';
import { metadataScreeningOf, videoServiceDeps } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000da';

describe('apps/server/api/services: applyVideoEdit', () => {
  let repositories: InMemoryRepositories;

  const apply = (user: UserContext, edit: Parameters<typeof applyVideoEdit>[3], options = {}) =>
    applyVideoEdit(
      {
        videos: repositories.videos,
        studio: repositories.videoStudio,
        videoService: new VideoService(
          videoServiceDeps(repositories.videos, { chapters: repositories.videoChapters })
        ),
        metadataScreening: metadataScreeningOf(repositories),
      },
      user,
      VIDEO_ID,
      edit,
      options
    );
  const history = async () =>
    expectOk(
      await repositories.entityRevisions.list('video_metadata', VIDEO_ID, {
        beforeVersion: null,
        limit: 10,
      })
    );

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        channelId: await seedPrimaryChannel(repositories, OWNER.id),
        title: 'Before',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/a.mp4',
        durationMs: 120_000,
      })
    );
  });

  it('writes the edit and a revision at the new version, with the version a restore went back to', async () => {
    const view = expectOk(
      await apply(OWNER, { title: 'After', version: 1 }, { restoredFromVersion: 1 })
    );

    const [latest] = await history();
    expect(view).toMatchObject({ title: 'After', version: 2 });
    expect(latest).toMatchObject({ version: 2, restoredFromVersion: 1, authorUserId: OWNER.id });
  });

  it.each([
    { name: 'a stale version', user: OWNER, version: 7, code: ErrorCodes.VERSION_CONFLICT },
    { name: 'a caller who may not edit', user: STRANGER, version: 1, code: ErrorCodes.FORBIDDEN },
  ])('leaves no revision behind for $name', async ({ user, version, code }) => {
    expect(expectErr(await apply(user, { title: 'After', version })).code).toBe(code);
    expect(await history()).toEqual([]);
  });

  it('replaces the chapters inside the same edit', async () => {
    const chapters = [
      { startMs: 0, title: 'A' },
      { startMs: 20_000, title: 'B' },
      { startMs: 40_000, title: 'C' },
    ];

    const view = expectOk(await apply(OWNER, { chapters, version: 1 }));

    expect(view.chapters).toEqual(chapters);
  });
});
