import { InMemoryCacheClient, InMemoryRepositories } from '@vp/adapters/in-memory';
import { CurrentPickSchema } from '@vp/api-contracts';
import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { inProcessAppConfig } from '@vp/env-schema';
import type { UserContext } from '@vp/permissions';
import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { seedVideo } from '../../__tests__/test-app';
import { CurrentPickCache } from '../current-pick-cache';
import { generateEtag } from '../http-cache';
import { PickService, type PickServiceDeps } from '../pick-service';
import { toVideoSummaryView } from '../video-views';
import { TEST_CDN, TEST_SPRITE } from './service-deps';

const HTTP_CACHE = inProcessAppConfig().httpCache.feed;

const ADMIN: UserContext = { id: '00000000-0000-7000-8000-00000000a001', role: 'ADMIN' };
const STRANGER: UserContext = { id: '00000000-0000-7000-8000-00000000a002', role: 'USER' };
const OWNER = '00000000-0000-7000-8000-00000000a0a1';
const VIDEO = '00000000-0000-7000-8000-00000000a0b1';
const SECOND = '00000000-0000-7000-8000-00000000a0b2';
const TRENDING = '00000000-0000-7000-8000-00000000a0b3';
const PRIVATE = '00000000-0000-7000-8000-00000000a0b4';
const PROCESSING = '00000000-0000-7000-8000-00000000a0b5';
const ABSENT = '00000000-0000-7000-8000-00000000a0b6';
const NOW = Date.parse('2026-03-01T12:00:00.000Z');
const HOUR = 3_600_000;
const instant = (ms: number) => new Date(ms).toISOString();

describe('apps/server/api/services: PickService', () => {
  let repositories: InMemoryRepositories;
  let store: InMemoryCacheClient;
  let service: PickService;
  let clock: number;
  let trendingItems: ReturnType<typeof toVideoSummaryView>[];

  const build = (overrides: Partial<PickServiceDeps> = {}) =>
    new PickService({
      picks: repositories.picks,
      videos: repositories.videos,
      channels: repositories.channels,
      feed: {
        getFeed: async () =>
          ok({
            data: { items: trendingItems, nextCursor: null, total: trendingItems.length },
            etag: '"x"',
            headers: {},
            notModified: false,
          }),
      },
      currentCache: new CurrentPickCache(store, HTTP_CACHE.maxAgeSeconds),
      cdn: TEST_CDN,
      sprite: TEST_SPRITE,
      ...HTTP_CACHE,
      now: () => clock,
      ...overrides,
    });

  const schedule = async (
    body: Partial<Parameters<PickService['create']>[1]> = {},
    caller: UserContext | null = ADMIN
  ) =>
    service.create(caller, {
      videoId: VIDEO,
      startsAt: instant(NOW - HOUR),
      endsAt: instant(NOW + 14 * HOUR),
      note: 'Worth the ten minutes',
      ...body,
    });

  beforeEach(async () => {
    clock = NOW;
    repositories = new InMemoryRepositories();
    store = new InMemoryCacheClient();
    service = build();
    await repositories.channels.create({ userId: OWNER, handle: 'owner', displayName: 'Owner' });
    for (const [id, extra] of [
      [VIDEO, {}],
      [SECOND, {}],
      [TRENDING, {}],
      [PRIVATE, { visibility: 'private' as const }],
      [PROCESSING, { status: 'PROCESSING' as const }],
    ] as const) {
      await seedVideo(repositories, {
        id,
        ownerId: OWNER,
        title: `Video ${id.slice(-2)}`,
        ...extra,
      });
    }
    const top = expectOk(await repositories.videos.findById(TRENDING));
    trendingItems = top ? [toVideoSummaryView(top, TEST_CDN, TEST_SPRITE, null)] : [];
  });

  describe('current', () => {
    it('answers the pick whose window holds now, with its note and when it ends', async () => {
      await schedule();

      const { data } = expectOk(await service.current());

      expect(data).toMatchObject({
        source: 'scheduled',
        note: 'Worth the ten minutes',
        startsAt: instant(NOW - HOUR),
        endsAt: instant(NOW + 14 * HOUR),
        video: { id: VIDEO, channel: { handle: 'owner' } },
      });
    });

    it.each([
      { name: 'nothing is scheduled', arrange: async () => {} },
      {
        name: 'the picked video turned private',
        arrange: async () => {
          await schedule();
          const video = expectOk(await repositories.videos.findById(VIDEO));
          expectOk(
            await repositories.videoStudio.updateMetadata({
              videoId: VIDEO,
              expectedVersion: video?.version ?? 0,
              patch: { visibility: 'private' },
              userId: OWNER,
            })
          );
        },
      },
    ])('falls back to the top trending video, with no note, when $name', async ({ arrange }) => {
      await arrange();

      const { data } = expectOk(await service.current());

      expect(data).toEqual({
        source: 'fallback',
        video: trendingItems[0],
        note: null,
        startsAt: null,
        endsAt: null,
      });
    });

    it('is a missing video when nothing is scheduled and nothing is trending', async () => {
      trendingItems = [];

      expect(expectErr(await service.current()).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
    });

    it.each([
      { name: 'at the start of its window', at: NOW - HOUR, source: 'scheduled' },
      { name: 'a moment before its window', at: NOW - HOUR - 1, source: 'fallback' },
      { name: 'a moment before its end', at: NOW + 14 * HOUR - 1, source: 'scheduled' },
      { name: 'at its end', at: NOW + 14 * HOUR, source: 'fallback' },
    ])('reads $name as $source', async ({ at, source }) => {
      await schedule();
      await store.clear();
      clock = at;

      expect(expectOk(await service.current()).data.source).toBe(source);
    });

    it('serves the scheduled pick from the cache, until it ends', async () => {
      await schedule();
      expectOk(await service.current());
      const read = vi.spyOn(repositories.picks, 'findCurrent');

      expect(expectOk(await service.current()).data.source).toBe('scheduled');
      expect(read).not.toHaveBeenCalled();
    });

    it('lets the cache go once the pick has ended', async () => {
      await schedule();
      expectOk(await service.current());
      clock = NOW + 14 * HOUR;

      expect(expectOk(await service.current()).data.source).toBe('fallback');
    });

    it.each([
      {
        name: 'a window with a long way to go',
        endsAt: NOW + 14 * HOUR,
        maxAge: HTTP_CACHE.maxAgeSeconds,
      },
      { name: 'a window about to end', endsAt: NOW + 20_000, maxAge: 20 },
    ])('lets a client keep $name for $maxAge seconds', async ({ endsAt, maxAge }) => {
      await schedule({ endsAt: instant(endsAt) });

      const { headers } = expectOk(await service.current());

      expect(headers['Cache-Control']).toContain(`max-age=${maxAge}`);
    });

    it('answers not modified to a client that holds the current etag', async () => {
      await schedule();
      const { data } = expectOk(await service.current());

      const again = expectOk(await service.current(generateEtag(CurrentPickSchema.parse(data))));

      expect(again.notModified).toBe(true);
    });

    it('passes a failing feed on', async () => {
      const failure = databaseUnavailable('feed', new Error('down'));
      service = build({ feed: { getFeed: async () => err(failure) } });

      expect(expectErr(await service.current())).toBe(failure);
    });
  });

  describe('list', () => {
    it('lists the picks of the next 30 days earliest first, each with its video', async () => {
      await schedule({
        startsAt: instant(NOW + 2 * 24 * HOUR),
        endsAt: instant(NOW + 3 * 24 * HOUR),
      });
      await schedule({ videoId: SECOND });
      await schedule({
        startsAt: instant(NOW + 40 * 24 * HOUR),
        endsAt: instant(NOW + 41 * 24 * HOUR),
      });

      const { items } = expectOk(await service.list(ADMIN, {}));

      expect(items.map((item) => item.video.id)).toEqual([SECOND, VIDEO]);
    });

    it('lists the range it is given', async () => {
      await schedule({
        startsAt: instant(NOW + 40 * 24 * HOUR),
        endsAt: instant(NOW + 41 * 24 * HOUR),
      });

      const { items } = expectOk(
        await service.list(ADMIN, {
          from: instant(NOW + 39 * 24 * HOUR),
          to: instant(NOW + 42 * 24 * HOUR),
        })
      );

      expect(items).toHaveLength(1);
    });

    it.each([
      { name: 'an anonymous caller', caller: null, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', caller: STRANGER, code: ErrorCodes.FORBIDDEN },
    ])('refuses $name with $code', async ({ caller, code }) => {
      expect(expectErr(await service.list(caller, {})).code).toBe(code);
    });
  });

  describe('create', () => {
    it('stores the pick with a fresh id, the admin and the clock, and answers it with its video', async () => {
      const created = expectOk(await schedule({ note: '  Worth it ' }));

      expect(created).toMatchObject({
        videoId: VIDEO,
        note: 'Worth it',
        createdBy: ADMIN.id,
        createdAt: instant(NOW),
        video: { id: VIDEO, channel: { handle: 'owner' } },
      });
      expect(expectOk(await repositories.picks.findById(created.id))).not.toBeNull();
    });

    it.each([
      { name: 'an anonymous caller', body: {}, caller: null, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', body: {}, caller: STRANGER, code: ErrorCodes.FORBIDDEN },
      {
        name: 'an absent video',
        body: { videoId: ABSENT },
        caller: ADMIN,
        code: ErrorCodes.VIDEO_NOT_FOUND,
      },
      {
        name: 'a private video',
        body: { videoId: PRIVATE },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a video still processing',
        body: { videoId: PROCESSING },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'a window in the past',
        body: { startsAt: instant(NOW - 3 * HOUR), endsAt: instant(NOW - HOUR) },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'an over-long note',
        body: { note: 'a'.repeat(281) },
        caller: ADMIN,
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name with $code and stores nothing', async ({ body, caller, code }) => {
      expect(expectErr(await schedule(body, caller)).code).toBe(code);
      expect(
        expectOk(await repositories.picks.listBetween({ from: new Date(0), to: new Date(NOW * 2) }))
      ).toEqual([]);
    });

    it('refuses a window another pick holds, but lets one start where it ends', async () => {
      await schedule();

      const overlap = await schedule({ videoId: SECOND, startsAt: instant(NOW + HOUR) });
      const adjacent = await schedule({
        videoId: SECOND,
        startsAt: instant(NOW + 14 * HOUR),
        endsAt: instant(NOW + 20 * HOUR),
      });

      expect(expectErr(overlap).code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
      expect(expectOk(adjacent).videoId).toBe(SECOND);
    });

    it('drops the cached current pick', async () => {
      await schedule();
      expectOk(await service.current());

      const second = await schedule({
        videoId: SECOND,
        startsAt: instant(NOW + 14 * HOUR),
        endsAt: instant(NOW + 20 * HOUR),
      });

      expectOk(second);
      expect(expectOk(await store.get('taitube:picks:current:v1'))).toBeNull();
    });

    it('passes a failing store on', async () => {
      const failure = databaseUnavailable('findOverlappingPick', new Error('down'));
      service = build({
        picks: Object.assign(Object.create(repositories.picks), {
          findOverlapping: async () => err(failure),
        }),
      });

      expect(expectErr(await schedule())).toBe(failure);
    });
  });

  describe('update', () => {
    it('changes the note and shows it on the next read of the current pick', async () => {
      const created = expectOk(await schedule());
      expectOk(await service.current());

      const updated = expectOk(await service.update(ADMIN, created.id, { note: 'New line' }));

      expect(updated).toMatchObject({ id: created.id, note: 'New line', videoId: VIDEO });
      expect(expectOk(await service.current()).data.note).toBe('New line');
    });

    it('clears the note, moves the video and keeps the window', async () => {
      const created = expectOk(await schedule());

      const updated = expectOk(
        await service.update(ADMIN, created.id, { videoId: SECOND, note: null })
      );

      expect(updated).toMatchObject({
        note: null,
        videoId: SECOND,
        video: { id: SECOND },
        startsAt: created.startsAt,
        endsAt: created.endsAt,
      });
    });

    it('lets a pick grow into free time and refuses growing into the next one', async () => {
      const first = expectOk(await schedule());
      expectOk(
        await schedule({
          videoId: SECOND,
          startsAt: instant(NOW + 20 * HOUR),
          endsAt: instant(NOW + 30 * HOUR),
        })
      );

      const grown = await service.update(ADMIN, first.id, { endsAt: instant(NOW + 18 * HOUR) });
      const blocked = await service.update(ADMIN, first.id, { endsAt: instant(NOW + 25 * HOUR) });

      expect(expectOk(grown).endsAt).toBe(instant(NOW + 18 * HOUR));
      expect(expectErr(blocked).code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
    });

    it.each([
      {
        name: 'an anonymous caller',
        caller: null,
        id: undefined,
        body: { note: 'x' },
        code: ErrorCodes.UNAUTHORIZED,
      },
      {
        name: 'a signed-in user',
        caller: STRANGER,
        id: undefined,
        body: { note: 'x' },
        code: ErrorCodes.FORBIDDEN,
      },
      {
        name: 'an unknown pick',
        caller: ADMIN,
        id: ABSENT,
        body: { note: 'x' },
        code: ErrorCodes.PICK_NOT_FOUND,
      },
      {
        name: 'a private video',
        caller: ADMIN,
        id: undefined,
        body: { videoId: PRIVATE },
        code: ErrorCodes.VALIDATION_FAILED,
      },
      {
        name: 'an over-long note',
        caller: ADMIN,
        id: undefined,
        body: { note: 'a'.repeat(281) },
        code: ErrorCodes.VALIDATION_FAILED,
      },
    ])('refuses $name with $code', async ({ caller, id, body, code }) => {
      const created = expectOk(await schedule());

      expect(expectErr(await service.update(caller, id ?? created.id, body)).code).toBe(code);
    });
  });

  describe('cancel', () => {
    it('removes the pick, also a running one, and the home falls back at once', async () => {
      const created = expectOk(await schedule());
      expectOk(await service.current());

      expectOk(await service.cancel(ADMIN, created.id));

      expect(expectOk(await repositories.picks.findById(created.id))).toBeNull();
      expect(expectOk(await service.current()).data.source).toBe('fallback');
    });

    it.each([
      { name: 'an anonymous caller', caller: null, id: undefined, code: ErrorCodes.UNAUTHORIZED },
      { name: 'a signed-in user', caller: STRANGER, id: undefined, code: ErrorCodes.FORBIDDEN },
      { name: 'an unknown pick', caller: ADMIN, id: ABSENT, code: ErrorCodes.PICK_NOT_FOUND },
    ])('refuses $name with $code', async ({ caller, id, code }) => {
      const created = expectOk(await schedule());

      expect(expectErr(await service.cancel(caller, id ?? created.id)).code).toBe(code);
      expect(expectOk(await repositories.picks.findById(created.id))).not.toBeNull();
    });
  });
});
