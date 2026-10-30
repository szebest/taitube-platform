import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { ClipService } from '../clip-service';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const VIEWER: UserContext = { id: '00000000-0000-7000-8000-00000000e001', role: 'USER' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000e002', role: 'USER' };
const OWNER = '00000000-0000-7000-8000-00000000e0a1';
const VIDEO = '00000000-0000-7000-8000-00000000e0b1';
const SECOND = '00000000-0000-7000-8000-00000000e0b2';
const PRIVATE = '00000000-0000-7000-8000-00000000e0b3';
const UNLISTED = '00000000-0000-7000-8000-00000000e0b4';
const PROCESSING = '00000000-0000-7000-8000-00000000e0b5';
const ABSENT = '00000000-0000-7000-8000-00000000e0b6';
const NOW = Date.parse('2026-03-01T12:00:00.000Z');

const RANGE = { startMs: 10_000, endMs: 30_000, title: '  The goal  ' };

describe('apps/server/api/services: ClipService', () => {
  let repositories: InMemoryRepositories;
  let service: ClipService;
  let clock: number;

  const clip = async (videoId = VIDEO, body = RANGE, viewer: UserContext | null = VIEWER) =>
    service.create(viewer, videoId, body);

  beforeEach(async () => {
    clock = NOW;
    repositories = new InMemoryRepositories();
    service = new ClipService({
      clips: repositories.clips,
      videos: repositories.videos,
      channels: repositories.channels,
      paginator: new Paginator({ defaultLimit: 20, maxLimit: 100 }),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
      now: () => clock,
    });
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
    for (const [id, extra] of [
      [VIDEO, {}],
      [SECOND, {}],
      [PRIVATE, { visibility: 'private' as const }],
      [UNLISTED, { visibility: 'unlisted' as const }],
      [PROCESSING, { status: 'PROCESSING' as const, durationMs: null }],
    ] as const) {
      await seedVideo(repositories, {
        id,
        ownerId: OWNER,
        title: 'Match',
        durationMs: 120_000,
        ...extra,
      });
    }
  });

  describe('create', () => {
    it('stores a clip of a public video and answers it with the video it plays from', async () => {
      const created = expectOk(await clip());

      expect(created).toMatchObject({
        videoId: VIDEO,
        userId: VIEWER.id,
        startMs: 10_000,
        endMs: 30_000,
        title: 'The goal',
        createdAt: new Date(NOW).toISOString(),
        video: { id: VIDEO, title: 'Match', channel: { handle: 'owner' } },
      });
      expect(created.video.playbackUrl).toContain(VIDEO);
      expect(expectOk(await service.get(null, created.id)).id).toBe(created.id);
    });

    it.each([
      { scenario: 'a guest', viewer: null, videoId: VIDEO, code: ErrorCodes.UNAUTHORIZED },
      {
        scenario: 'a video that is absent',
        viewer: VIEWER,
        videoId: ABSENT,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: "someone else's private video",
        viewer: STRANGER,
        videoId: PRIVATE,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        scenario: 'an unlisted video',
        viewer: VIEWER,
        videoId: UNLISTED,
        code: ErrorCodes.FORBIDDEN,
      },
      {
        scenario: 'a video still processing',
        viewer: VIEWER,
        videoId: PROCESSING,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $scenario with $code', async ({ viewer, videoId, code }) => {
      expect(expectErr(await clip(videoId, RANGE, viewer)).code).toBe(code);
    });

    it.each([
      { scenario: 'a range under five seconds', body: { ...RANGE, endMs: 12_000 } },
      { scenario: 'a range over sixty seconds', body: { ...RANGE, endMs: 80_000 } },
      {
        scenario: 'a range past the end of the video',
        body: { ...RANGE, startMs: 110_000, endMs: 130_000 },
      },
      { scenario: 'an empty title', body: { ...RANGE, title: '   ' } },
    ])('refuses $scenario', async ({ body }) => {
      expect(expectErr(await clip(VIDEO, body)).code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(expectOk(await service.listMine(VIEWER, {})).items).toEqual([]);
    });

    it('passes a storage failure on', async () => {
      vi.spyOn(repositories.clips, 'create').mockResolvedValue(
        err(databaseUnavailable('createClip'))
      );

      expect(expectErr(await clip()).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
    });
  });

  describe('get', () => {
    it('answers not found for an unknown clip', async () => {
      expect(expectErr(await service.get(null, ABSENT)).code).toBe(ErrorCodes.CLIP_NOT_FOUND);
    });

    it('stops resolving a clip once its video turned private, for everyone but those who may read it', async () => {
      const { id } = expectOk(await clip());
      const stored = expectOk(await repositories.videos.findById(VIDEO));
      if (stored) stored.visibility = 'private';

      expect(expectErr(await service.get(null, id)).code).toBe(ErrorCodes.CLIP_NOT_FOUND);
      expect(expectErr(await service.get(VIEWER, id)).code).toBe(ErrorCodes.CLIP_NOT_FOUND);
    });
  });

  describe('listMine', () => {
    it('lists the caller clips newest first with their videos, a page at a time', async () => {
      const first = expectOk(await clip(VIDEO));
      clock += 60_000;
      const second = expectOk(await clip(SECOND));
      clock += 60_000;
      const third = expectOk(await clip(VIDEO));
      expectOk(await clip(VIDEO, RANGE, STRANGER));

      const page = expectOk(await service.listMine(VIEWER, { limit: 2 }));
      const rest = expectOk(
        await service.listMine(VIEWER, { limit: 2, cursor: page.nextCursor ?? '' })
      );

      expect(page.items.map((item) => item.id)).toEqual([third.id, second.id]);
      expect(page.items[0]?.video).toMatchObject({ id: VIDEO, title: 'Match' });
      expect(rest.items.map((item) => item.id)).toEqual([first.id]);
      expect(rest.nextCursor).toBeNull();
    });

    it('refuses a cursor that is not one', async () => {
      expect(expectErr(await service.listMine(VIEWER, { cursor: 'nope' })).code).toBe(
        ErrorCodes.INVALID_CURSOR
      );
    });
  });

  describe('remove', () => {
    it.each([
      { scenario: 'a guest', actor: null, code: ErrorCodes.UNAUTHORIZED },
      { scenario: 'another viewer', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    ])('keeps the clip from $scenario', async ({ actor, code }) => {
      const { id } = expectOk(await clip());

      expect(expectErr(await service.remove(actor, id)).code).toBe(code);
      expectOk(await service.get(null, id));
    });

    it('lets the creator delete it, also once the video turned private, and once only', async () => {
      const { id } = expectOk(await clip());
      const stored = expectOk(await repositories.videos.findById(VIDEO));
      if (stored) stored.visibility = 'private';

      expectOk(await service.remove(VIEWER, id));

      expect(expectErr(await service.remove(VIEWER, id)).code).toBe(ErrorCodes.CLIP_NOT_FOUND);
    });

    it('lets an admin delete any clip', async () => {
      const { id } = expectOk(await clip());

      expectOk(await service.remove({ id: STRANGER.id, role: 'ADMIN' }, id));

      expect(expectErr(await service.get(null, id)).code).toBe(ErrorCodes.CLIP_NOT_FOUND);
    });
  });
});
