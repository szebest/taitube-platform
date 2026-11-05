import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { LiveService } from '../live-service';
import { liveWorld, OWNER, STARTED, STREAM_ID, VIEWER } from './live-harness';
import { TEST_CDN } from './service-deps';

describe('apps/server/api/services: LiveService', () => {
  let repositories: InMemoryRepositories;
  let service: LiveService;

  async function setUp(world: Parameters<typeof liveWorld>[0] = {}) {
    ({ repositories } = await liveWorld(world));
    service = new LiveService({
      liveStreams: repositories.liveStreams,
      channels: repositories.channels,
      videos: repositories.videos,
      liveChat: repositories.liveChat,
      subscriptions: repositories.subscriptions,
      viewers: async () => ok(4),
      cdn: TEST_CDN,
      limits: { list: 48, replay: 2 },
    });
  }

  beforeEach(async () => {
    await setUp();
  });

  it('lists a public broadcast with its channel and viewers', async () => {
    const { items } = expectOk(await service.list());

    expect(items).toEqual([
      expect.objectContaining({
        id: STREAM_ID,
        viewers: 4,
        channel: expect.objectContaining({ handle: 'night-kitchen' }),
      }),
    ]);
  });

  it('lists nothing while the only broadcast is unlisted', async () => {
    await setUp({ visibility: 'unlisted' });

    expect(expectOk(await service.list()).items).toEqual([]);
  });

  it('shows an overlay its stream and the subscriber count, before it goes live too', async () => {
    await setUp({ live: false });
    const channel = expectOk(await repositories.channels.findByUserId(OWNER.id));
    expectOk(await repositories.subscriptions.subscribe(VIEWER.id, channel?.id ?? ''));

    expect(expectOk(await service.overlay('overlay-token'))).toMatchObject({
      stream: { id: STREAM_ID, status: 'IDLE', viewers: 0 },
      subscriberCount: 1,
    });
    expect(expectErr(await service.overlay('control-token')).code).toBe(
      ErrorCodes.LIVE_STREAM_NOT_FOUND
    );
  });

  it('replays the lines of an offset window, a page at a time', async () => {
    for (const [n, offsetMs] of [
      [1, 500],
      [2, 1_500],
      [3, 2_500],
      [4, 9_000],
    ] as const) {
      expectOk(
        await repositories.liveChat.append({
          id: `00000000-0000-7000-8000-00000000000${n}`,
          liveStreamId: STREAM_ID,
          userId: VIEWER.id,
          message: `line ${n}`,
          offsetMs,
          createdAt: STARTED,
        })
      );
    }

    const { items } = expectOk(
      await service.replay(null, STREAM_ID, { fromMs: 1_000, toMs: 9_000 })
    );

    expect(items.map((item) => item.offsetMs)).toEqual([1_500, 2_500]);
  });
});
