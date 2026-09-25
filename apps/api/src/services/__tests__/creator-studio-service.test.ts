import { InMemoryRepositories } from '@vp/adapters/in-memory';
import type { NewVideoInput } from '@vp/core/repositories';
import { ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { CreatorStudioService } from '../creator-studio-service';
import { VideoService } from '../video-service';
import { TEST_CDN, videoServiceDeps } from './service-deps';

const OWNER: UserContext = { id: '00000000-0000-7000-8000-0000000000d1', role: 'CREATOR' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-0000000000d2', role: 'USER' };
const ADMIN: UserContext = { id: '00000000-0000-7000-8000-0000000000d3', role: 'ADMIN' };
const VIDEO_ID = '00000000-0000-7000-8000-0000000000da';
const OTHER_VIDEO_ID = '00000000-0000-7000-8000-0000000000db';
const CATEGORY_ID = '00000000-0000-7000-8000-0000000000dc';
const THUMBNAIL_ID = '00000000-0000-7000-8000-0000000000dd';

describe('apps/api/services: creator studio', () => {
  let repositories: InMemoryRepositories;
  let studio: CreatorStudioService;

  async function seed(overrides: Partial<NewVideoInput> = {}) {
    return expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER.id,
        title: 'Studio fixture',
        visibility: 'public',
        status: 'READY',
        sourceKey: 'raw/studio.mp4',
        posterKey: `videos/${VIDEO_ID}/thumbs/poster.jpg`,
        ...overrides,
      })
    );
  }

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    const paginator = new Paginator();
    studio = new CreatorStudioService({
      videos: repositories.videos,
      studio: repositories.videoStudio,
      videoService: new VideoService(videoServiceDeps(repositories.videos)),
      cdn: TEST_CDN,
      paginator,
    });
    expectOk(
      await repositories.categories.create({ id: CATEGORY_ID, slug: 'music', name: 'Music' })
    );
  });

  describe('library', () => {
    it('pages through the caller videos in the chosen sort with their counters', async () => {
      await seed({ viewsCount: 3, commentsCount: 1, tags: ['a'] });
      await seed({ id: OTHER_VIDEO_ID, viewsCount: 9 });

      const first = expectOk(await studio.library(OWNER, { sort: 'views', limit: 1 }));
      expect(first.items.map((item) => [item.id, item.viewsCount])).toEqual([[OTHER_VIDEO_ID, 9]]);

      const cursor = first.nextCursor ?? undefined;
      const second = expectOk(await studio.library(OWNER, { sort: 'views', limit: 1, cursor }));
      expect(second).toMatchObject({
        items: [{ id: VIDEO_ID, commentsCount: 1, tags: ['a'] }],
        nextCursor: null,
      });
    });

    it('lists nothing of anyone else', async () => {
      await seed();

      expect(expectOk(await studio.library(STRANGER, { sort: 'newest' })).items).toEqual([]);
    });

    it('refuses a cursor carried over from another sort', async () => {
      await seed();
      await seed({ id: OTHER_VIDEO_ID });
      const page = expectOk(await studio.library(OWNER, { sort: 'views', limit: 1 }));

      const failure = expectErr(
        await studio.library(OWNER, { sort: 'likes', cursor: page.nextCursor ?? undefined })
      );

      expect(failure.code).toBe(ErrorCodes.INVALID_CURSOR);
    });
  });

  describe('update', () => {
    it('stores the studio fields and answers with the video as it now reads', async () => {
      const { version } = await seed();

      const view = expectOk(
        await studio.update(OWNER, VIDEO_ID, {
          tags: [' lofi ', 'LOFI'],
          categoryId: CATEGORY_ID,
          selectedThumbnail: { source: 'custom', thumbnailId: THUMBNAIL_ID, format: 'png' },
          version,
        })
      );

      expect(view).toMatchObject({
        tags: ['lofi'],
        categoryId: CATEGORY_ID,
        thumbnailUrl: `${TEST_CDN}/videos/${VIDEO_ID}/thumbs/custom/${THUMBNAIL_ID}.png`,
        version: version + 1,
      });
    });

    it('goes back to the generated poster', async () => {
      const { version } = await seed();
      expectOk(
        await studio.update(OWNER, VIDEO_ID, {
          selectedThumbnail: { source: 'custom', thumbnailId: THUMBNAIL_ID, format: 'jpg' },
          version,
        })
      );

      const view = expectOk(
        await studio.update(OWNER, VIDEO_ID, {
          selectedThumbnail: { source: 'poster' },
          version: version + 1,
        })
      );

      expect(view.thumbnailUrl).toBe(`${TEST_CDN}/videos/${VIDEO_ID}/thumbs/poster.jpg`);
    });

    it.each([
      {
        name: 'a stale version',
        patch: (version: number) => ({ title: 'Stale', version: version - 1 }),
        code: ErrorCodes.VERSION_CONFLICT,
      },
      {
        name: 'a category that is not there',
        patch: (version: number) => ({ categoryId: THUMBNAIL_ID, version }),
        code: ErrorCodes.CATEGORY_NOT_FOUND,
      },
      {
        name: 'too many tags',
        patch: (version: number) => ({
          tags: Array.from({ length: 31 }, (_, i) => `t${i}`),
          version,
        }),
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name as $code', async ({ patch, code }) => {
      const { version } = await seed();

      expect(expectErr(await studio.update(OWNER, VIDEO_ID, patch(version))).code).toBe(code);
    });

    it('refuses a stranger and lets an admin edit anyone', async () => {
      const { version } = await seed();

      expect(
        expectErr(await studio.update(STRANGER, VIDEO_ID, { title: 'Hijack', version })).code
      ).toBe(ErrorCodes.FORBIDDEN);
      expect(
        expectOk(await studio.update(ADMIN, VIDEO_ID, { title: 'Fixed', version })).title
      ).toBe('Fixed');
    });
  });

  describe('takeDown', () => {
    it('rejects and hides the video, and its owner cannot publish it again', async () => {
      await seed();

      const view = expectOk(await studio.takeDown(ADMIN, VIDEO_ID, 'Terms of service'));
      expect(view).toMatchObject({ status: 'REJECTED', visibility: 'private' });

      const reopened = await studio.update(OWNER, VIDEO_ID, {
        visibility: 'public',
        version: view.version,
      });
      expect(expectErr(reopened).code).toBe(ErrorCodes.FORBIDDEN);
    });

    it('lets an admin publish a taken-down video again', async () => {
      await seed();
      const { version } = expectOk(await studio.takeDown(ADMIN, VIDEO_ID));

      const view = expectOk(
        await studio.update(ADMIN, VIDEO_ID, { visibility: 'public', version })
      );

      expect(view.visibility).toBe('public');
    });

    it.each([
      { name: 'the owner', actor: OWNER, code: ErrorCodes.FORBIDDEN },
      { name: 'someone else', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    ])('refuses $name', async ({ actor, code }) => {
      await seed();

      expect(expectErr(await studio.takeDown(actor, VIDEO_ID)).code).toBe(code);
    });

    it('reports a video that is not there as absent', async () => {
      expect(expectErr(await studio.takeDown(ADMIN, VIDEO_ID)).code).toBe(
        ErrorCodes.VIDEO_NOT_FOUND
      );
    });
  });
});
