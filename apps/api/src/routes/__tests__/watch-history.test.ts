import { MS_PER_HOUR } from '@vp/domain/time';
import { ErrorCodes, cacheUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import {
  ABSENT,
  type LibraryApp,
  OWNER,
  PRIVATE_VIDEO,
  VIDEOS,
  buildLibraryApp,
} from '../../__tests__/library-app';

const [V0, V1, V2] = VIDEOS;

describe('watch history routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const save = (videoId: string, progressSeconds: number, reason?: string) =>
    ctx.call('owner', 'POST', '/v1/me/history', {
      videoId,
      progressSeconds,
      durationSeconds: 600,
      ...(reason ? { reason } : {}),
    });

  const history = async (query = '') =>
    (await ctx.call('owner', 'GET', `/v1/me/history${query}`)).json();

  const playhead = async (videoId: string) =>
    (await ctx.call('owner', 'GET', `/v1/me/history/${videoId}`)).json().playhead;

  it.each([
    { method: 'POST' as const, url: '/v1/me/history' },
    { method: 'GET' as const, url: '/v1/me/history' },
    { method: 'DELETE' as const, url: '/v1/me/history' },
    { method: 'GET' as const, url: `/v1/me/history/${ABSENT}` },
    { method: 'DELETE' as const, url: `/v1/me/history/${ABSENT}` },
  ])('refuses an anonymous $method $url with 401', async ({ method, url }) => {
    const res = await ctx.call('anonymous', method, url, {
      videoId: ABSENT,
      progressSeconds: 1,
      durationSeconds: 2,
    });

    expect(res.statusCode).toBe(401);
  });

  it('syncs a position at 45 s and lists it with the video and its channel', async () => {
    const saved = await save(V0, 45);

    expect(saved.statusCode).toBe(200);
    const { items } = await history();
    expect(items).toMatchObject([
      {
        videoId: V0,
        progressSeconds: 45,
        durationSeconds: 600,
        progressPercent: 7,
        completed: false,
        resumeAtSeconds: 45,
        video: { id: V0, title: 'Clip 0' },
        channel: { handle: 'creator' },
      },
    ]);
  });

  it('marks a video watched past 92 % completed, to be replayed from the start', async () => {
    const saved = (await save(V0, 553, 'ended')).json();

    expect(saved).toMatchObject({ completed: true, resumeAtSeconds: 0, progressPercent: 92 });
  });

  it('buffers heartbeats after the first, and serves the resume point from the buffer', async () => {
    const record = vi.spyOn(ctx.repositories.watchHistory, 'record');
    await save(V0, 5, 'heartbeat');
    await save(V0, 10, 'heartbeat');
    await save(V0, 15, 'heartbeat');

    expect(record).toHaveBeenCalledTimes(1);
    expect(await playhead(V0)).toMatchObject({ progressSeconds: 15 });
    expect((await history()).items[0]).toMatchObject({ progressSeconds: 5 });

    await save(V0, 20, 'pause');
    expect(record).toHaveBeenCalledTimes(2);
    expect((await history()).items[0]).toMatchObject({ progressSeconds: 20 });
  });

  it('writes every beat through while the buffer is down', async () => {
    const record = vi.spyOn(ctx.repositories.watchHistory, 'record');
    await save(V0, 5, 'heartbeat');
    vi.spyOn(ctx.cache, 'get').mockResolvedValue(err(cacheUnavailable('get')));

    await save(V0, 10, 'heartbeat');

    expect(record).toHaveBeenCalledTimes(2);
    expect((await history()).items[0]).toMatchObject({ progressSeconds: 10 });
  });

  it('pages the history newest first', async () => {
    for (const [hoursAgo, videoId] of [V0, V1, V2].reverse().entries()) {
      await ctx.repositories.watchHistory.record({
        id: `00000000-0000-7000-8000-0000000007${hoursAgo}0`,
        userId: OWNER,
        videoId,
        progressSeconds: 30,
        durationSeconds: 600,
        watchedAt: new Date(Date.parse('2026-03-01T12:00:00Z') - hoursAgo * MS_PER_HOUR),
      });
    }

    const first = await history('?limit=2');
    const rest = await history(`?limit=2&cursor=${first.nextCursor}`);

    expect(first.items.map((item: { videoId: string }) => item.videoId)).toEqual([V2, V1]);
    expect(rest.items.map((item: { videoId: string }) => item.videoId)).toEqual([V0]);
    expect(rest.nextCursor).toBeNull();
  });

  it('removes one video, then clears everything, buffered playheads included', async () => {
    await save(V0, 30);
    await save(V1, 30);

    expect((await ctx.call('owner', 'DELETE', `/v1/me/history/${V0}`)).statusCode).toBe(204);
    expect(await playhead(V0)).toBeNull();
    expect((await ctx.call('owner', 'DELETE', '/v1/me/history')).statusCode).toBe(204);
    expect(await playhead(V1)).toBeNull();
    expect((await history()).items).toEqual([]);
  });

  it('refuses a position on a video the caller may not watch', async () => {
    const res = await save(PRIVATE_VIDEO, 5);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('keeps each user’s history their own', async () => {
    await save(V0, 30);

    const theirs = (await ctx.call('stranger', 'GET', '/v1/me/history')).json();

    expect(theirs.items).toEqual([]);
  });
});
