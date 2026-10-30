import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  buildLibraryApp,
  type LibraryApp,
  PRIVATE_VIDEO,
  VIDEOS,
} from '../../__tests__/library-app';

const [V0, V1] = VIDEOS;

describe('home and related routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const watch = (videoId: string, progressSeconds: number) =>
    ctx.call('owner', 'POST', '/v1/me/history', {
      videoId,
      progressSeconds,
      durationSeconds: 600,
      reason: 'pause',
    });

  const shelves = async (who: 'owner' | 'anonymous') =>
    (await ctx.call(who, 'GET', '/v1/home')).json().shelves as {
      kind: string;
      items: { id: string; reason: { kind: string } }[];
    }[];

  it('serves an anonymous visitor the trending shelf, private to the caller', async () => {
    const res = await ctx.call('anonymous', 'GET', '/v1/home');

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-cache');
    expect(res.headers.vary).toBe('Authorization');
    expect(res.json().shelves.map(({ kind }: { kind: string }) => kind)).toEqual(['trending']);
  });

  it('changes the next home after a new watch', async () => {
    expect((await shelves('owner')).map(({ kind }) => kind)).toEqual(['trending']);

    await watch(V0, 60);
    const afterFirst = await shelves('owner');
    await watch(V1, 30);
    const afterSecond = await shelves('owner');

    const continued = (page: typeof afterFirst) =>
      page.find(({ kind }) => kind === 'continue')?.items.map(({ id }) => id);
    expect(continued(afterFirst)).toEqual([V0]);
    expect(continued(afterSecond)).toEqual([V1, V0]);
  });

  it('lists the other videos of the channel as related, never the video itself or a private one', async () => {
    const res = await ctx.call('anonymous', 'GET', `/v1/videos/${V0}/related`);

    const items: { id: string; reason: { kind: string } }[] = res.json().items;
    expect(res.statusCode).toBe(200);
    expect(items.map(({ id }) => id).sort()).toEqual(VIDEOS.filter((id) => id !== V0).sort());
    expect(items.every(({ reason }) => reason.kind === 'same-channel')).toBe(true);
    expect(items.map(({ id }) => id)).not.toContain(PRIVATE_VIDEO);
  });

  it.each([
    { scenario: 'a private video of somebody else', videoId: PRIVATE_VIDEO },
    { scenario: 'a video that is not there', videoId: ABSENT },
  ])('answers 404 for $scenario', async ({ videoId }) => {
    const res = await ctx.call('stranger', 'GET', `/v1/videos/${videoId}/related`);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(ErrorCodes.VIDEO_NOT_FOUND);
  });

  it('shows progress on a feed page from the feed request alone, and keeps that page out of shared caches', async () => {
    await watch(V0, 120);

    const res = await ctx.call('owner', 'GET', '/v1/feed');

    expect(res.headers['cache-control']).toMatch(/^private,/);
    expect(res.json().items.find(({ id }: { id: string }) => id === V0).viewer).toMatchObject({
      progressSeconds: 120,
    });
  });
});
