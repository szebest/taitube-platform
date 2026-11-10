import { expectOk } from '@vp/testing/result';
import { seedVideo } from '../../../__tests__/test-app';
import { presentQueue } from '../watch-party-queue-views';
import { OWNER, START, watchPartyTestDeps } from './watch-party-test-deps';

const VIDEO_ID = '018f0000-0000-7000-8000-0000000000a1';
const GONE_ID = '018f0000-0000-7000-8000-0000000000a2';
const ROOM_ID = '018f0000-0000-7000-8000-0000000000b1';

const item = (id: string, videoId: string, overrides = {}) => ({
  id,
  roomId: ROOM_ID,
  videoId,
  addedBy: `user:${OWNER.id}`,
  position: 0,
  startMs: 1500,
  playedAt: null,
  removedAt: null,
  createdAt: new Date(START),
  ...overrides,
});

describe('presentQueue', () => {
  it('shows each item with its video, and an item whose video is gone with no title', async () => {
    const { deps, repositories } = watchPartyTestDeps();
    await seedVideo(repositories, {
      id: VIDEO_ID,
      ownerId: OWNER.id,
      title: 'Opening night',
      durationMs: 90_000,
      posterKey: 'posters/a1.jpg',
    });
    const played = new Date(START + 1000);

    const view = await presentQueue(deps, {
      version: 7,
      items: [
        item('018f0000-0000-7000-8000-0000000000c1', VIDEO_ID, { playedAt: played }),
        item('018f0000-0000-7000-8000-0000000000c2', GONE_ID, { startMs: 0 }),
      ],
    });

    expect(expectOk(view)).toEqual({
      version: 7,
      items: [
        {
          id: '018f0000-0000-7000-8000-0000000000c1',
          video: {
            id: VIDEO_ID,
            title: 'Opening night',
            durationMs: 90_000,
            thumbnailUrl: 'http://localhost:9000/public/posters/a1.jpg',
          },
          addedBy: `user:${OWNER.id}`,
          startMs: 1500,
          playedAt: played.toISOString(),
        },
        {
          id: '018f0000-0000-7000-8000-0000000000c2',
          video: { id: GONE_ID, title: null, durationMs: null, thumbnailUrl: null },
          addedBy: `user:${OWNER.id}`,
          startMs: 0,
          playedAt: null,
        },
      ],
    });
  });
});
