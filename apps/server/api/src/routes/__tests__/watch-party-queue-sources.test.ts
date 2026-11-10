import { WATCH_PARTY_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import {
  type Account,
  buildRoomApp,
  ROOM_ID,
  type RoomApp,
  videoId,
} from '../../__tests__/watch-party-room-app';

const QUEUE = `/v1/watch-parties/${ROOM_ID}/queue`;

describe('what a watch party queue accepts', () => {
  let ctx: RoomApp;
  let owner: Account;

  beforeEach(async () => {
    ctx = await buildRoomApp();
    ({ owner } = ctx);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const add = async (who: Account | null, n: number) =>
    ctx.call(who, 'POST', QUEUE, { videoId: videoId(n) });
  const seedVideos = async (count: number) => {
    for (let n = 1; n <= count; n += 1) await ctx.video(n);
  };

  it.each([
    { room: 'unlisted', video: { visibility: 'public' }, label: 'a public video', status: 201 },
    {
      room: 'unlisted',
      video: { visibility: 'unlisted' },
      label: 'an unlisted video',
      status: 201,
    },
    { room: 'unlisted', video: { visibility: 'private' }, label: 'a private video', status: 422 },
    { room: 'unlisted', video: { status: 'LIVE' }, label: 'a live broadcast', status: 422 },
    {
      room: 'unlisted',
      video: { status: 'PROCESSING' },
      label: 'a video still processing',
      status: 422,
    },
    { room: 'public', video: { visibility: 'public' }, label: 'a public video', status: 201 },
    { room: 'public', video: { visibility: 'unlisted' }, label: 'an unlisted video', status: 422 },
    { room: 'public', video: { visibility: 'private' }, label: 'a private video', status: 422 },
    { room: 'private', video: { visibility: 'unlisted' }, label: 'an unlisted video', status: 201 },
    { room: 'private', video: { visibility: 'private' }, label: 'a private video', status: 422 },
  ] as const)('answers $status to $label in a $room room', async ({ room, video, status }) => {
    await ctx.roomIs(room);
    await ctx.video(1, { ...video });

    const res = await add(owner, 1);

    expect(res.statusCode).toBe(status);
    if (status === 422) expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE);
  });

  it('refuses a video that does not exist', async () => {
    const res = await add(owner, 99);

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE);
  });

  describe('a playlist', () => {
    const PLAYLIST_ID = '018f0000-0000-7000-8000-00000000d001';

    const seedPlaylist = async (videoNumbers: number[]) => {
      const { playlists } = ctx.repositories;
      expectOk(
        await playlists.create({
          id: PLAYLIST_ID,
          ownerId: owner.user.id,
          title: 'Mix',
          description: '',
          visibility: 'private',
        })
      );
      for (const n of videoNumbers) {
        expectOk(await playlists.addItem(PLAYLIST_ID, { id: uuidv7(), videoId: videoId(n) }));
      }
    };

    it.each([
      { room: 'unlisted', kept: [1, 2] },
      { room: 'public', kept: [1] },
    ] as const)('keeps what a $room room may share, in order', async ({ room, kept }) => {
      await ctx.roomIs(room);
      await ctx.video(1);
      await ctx.video(2, { visibility: 'unlisted' });
      await ctx.video(3, { visibility: 'private' });
      await seedPlaylist([1, 2, 3]);

      const res = await ctx.call(owner, 'POST', QUEUE, { playlistId: PLAYLIST_ID });

      expect(res.statusCode).toBe(201);
      expect(res.json().items.map((item: { video: { id: string } }) => item.video.id)).toEqual(
        kept.map(videoId)
      );
    });

    it.each([
      { scenario: 'holds only videos that cannot be shared', playlist: [3] },
      { scenario: 'is empty', playlist: [] },
      { scenario: 'does not exist', playlist: null },
    ])('is refused when it $scenario', async ({ playlist }) => {
      await ctx.video(3, { visibility: 'private' });
      if (playlist !== null) await seedPlaylist(playlist);

      const res = await ctx.call(owner, 'POST', QUEUE, { playlistId: PLAYLIST_ID });

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_VIDEO_NOT_SHAREABLE);
    });
  });

  it('refuses an add that would pass the queue limit, for someone who may reorder', async () => {
    await seedVideos(1);
    const { watchPartyQueue } = ctx.repositories;
    const items = Array.from({ length: WATCH_PARTY_LIMITS.queueItems }, () => ({
      id: uuidv7(),
      roomId: ROOM_ID,
      videoId: videoId(1),
      addedBy: owner.key,
      startMs: 0,
      createdAt: new Date(),
    }));
    expectOk(await watchPartyQueue.append(ROOM_ID, items, WATCH_PARTY_LIMITS.queueItems));

    const res = await add(owner, 1);

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.WATCH_PARTY_QUEUE_FULL);
  });
});
