import { CurrentPickSchema } from '@vp/api-contracts';
import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import type { CurrentPickService } from '../current-pick-service';
import { generateEtag } from '../http-cache';
import type { PickService } from '../pick-service';
import {
  HOUR,
  HTTP_CACHE,
  instant,
  NOW,
  OWNER,
  type PickWorld,
  pickWorld,
  VIDEO,
} from './pick-fixtures';

describe('apps/server/api/services: CurrentPickService', () => {
  let world: PickWorld;
  let picks: PickService;
  let service: CurrentPickService;

  const schedule = (body: Parameters<PickWorld['schedule']>[1] = {}) => world.schedule(picks, body);

  beforeEach(async () => {
    world = await pickWorld();
    picks = world.pickService();
    service = world.currentPickService();
  });

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
        const video = expectOk(await world.repositories.videos.findById(VIDEO));
        expectOk(
          await world.repositories.videoStudio.updateMetadata({
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
      video: world.trending.items[0],
      note: null,
      startsAt: null,
      endsAt: null,
    });
  });

  it('is a missing video when nothing is scheduled and nothing is trending', async () => {
    world.trending.items = [];

    expect(expectErr(await service.current()).code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it.each([
    { name: 'at the start of its window', at: NOW - HOUR, source: 'scheduled' },
    { name: 'a moment before its window', at: NOW - HOUR - 1, source: 'fallback' },
    { name: 'a moment before its end', at: NOW + 14 * HOUR - 1, source: 'scheduled' },
    { name: 'at its end', at: NOW + 14 * HOUR, source: 'fallback' },
  ])('reads $name as $source', async ({ at, source }) => {
    await schedule();
    await world.store.clear();
    world.clock.now = at;

    expect(expectOk(await service.current()).data.source).toBe(source);
  });

  it('serves the scheduled pick from the cache, until it ends', async () => {
    await schedule();
    expectOk(await service.current());
    const read = vi.spyOn(world.repositories.picks, 'findCurrent');

    expect(expectOk(await service.current()).data.source).toBe('scheduled');
    expect(read).not.toHaveBeenCalled();
  });

  it('lets the cache go once the pick has ended', async () => {
    await schedule();
    expectOk(await service.current());
    world.clock.now = NOW + 14 * HOUR;

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
    service = world.currentPickService({ feed: { getFeed: async () => err(failure) } });

    expect(expectErr(await service.current())).toBe(failure);
  });
});
