import { ErrorCodes } from '@vp/errors';
import {
  ABSENT,
  type LibraryApp,
  PRIVATE_VIDEO,
  VIDEOS,
  buildLibraryApp,
} from '../../__tests__/library-app';

const PATH = '/v1/me/recommendation-feedback';
const [HIDDEN, KEPT] = VIDEOS;
const feedbackId = (n: number) => `00000000-0000-7000-8000-00000000f1${String(n).padStart(2, '0')}`;

describe('recommendation feedback routes', () => {
  let ctx: LibraryApp;

  beforeEach(async () => {
    ctx = await buildLibraryApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  const channelId = async () => {
    const channel = await ctx.repositories.channels.findByUserId(
      '44444444-4444-7444-8444-444444444444'
    );
    return channel.ok && channel.value ? channel.value.id : '';
  };

  const hideVideo = async (videoId: string, who: 'owner' | 'stranger' = 'owner') =>
    ctx.call(who, 'PUT', PATH, { kind: 'not_interested', videoId });

  const homeIds = async (who: 'owner' | 'anonymous' = 'owner') =>
    (await ctx.call(who, 'GET', '/v1/home'))
      .json()
      .shelves.flatMap((shelf: { items: { id: string }[] }) => shelf.items.map(({ id }) => id));

  it.each([
    { method: 'PUT' as const, url: PATH, payload: { kind: 'not_interested', videoId: HIDDEN } },
    { method: 'GET' as const, url: PATH },
    { method: 'DELETE' as const, url: `${PATH}/${feedbackId(1)}` },
  ])('refuses an anonymous $method with 401', async ({ method, url, payload }) => {
    expect((await ctx.call('anonymous', method, url, payload)).statusCode).toBe(401);
  });

  it('stores "not interested" and answers the same row when it is put again', async () => {
    const first = await hideVideo(HIDDEN);
    const again = await hideVideo(HIDDEN);

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ kind: 'not_interested', videoId: HIDDEN });
    expect(again.json()).toEqual(first.json());
  });

  it('stores a hidden channel', async () => {
    const res = await ctx.call('owner', 'PUT', PATH, {
      kind: 'hide_channel',
      channelId: await channelId(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ kind: 'hide_channel', channelId: await channelId() });
  });

  it('stores feedback while the viewer has paused their history', async () => {
    const paused = await ctx.call('owner', 'PATCH', '/v1/me/preferences', {
      version: 0,
      privacy: { historyPaused: true },
    });
    expect(paused.statusCode).toBe(200);

    expect((await hideVideo(HIDDEN)).statusCode).toBe(200);

    expect((await ctx.call('owner', 'GET', PATH)).json().items).toHaveLength(1);
  });

  it.each([
    {
      scenario: 'a video the caller may not read',
      payload: { kind: 'not_interested', videoId: PRIVATE_VIDEO },
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'an unknown video',
      payload: { kind: 'not_interested', videoId: ABSENT },
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      scenario: 'an unknown channel',
      payload: { kind: 'hide_channel', channelId: ABSENT },
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
  ])('answers 404 for $scenario', async ({ payload, code }) => {
    const res = await ctx.call('owner', 'PUT', PATH, payload);

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe(code);
  });

  it.each([
    { scenario: 'an unknown kind', payload: { kind: 'dislike', videoId: HIDDEN } },
    {
      scenario: 'a kind with the wrong target',
      payload: { kind: 'hide_channel', videoId: HIDDEN },
    },
    { scenario: 'a target that is not a UUID', payload: { kind: 'not_interested', videoId: 'x' } },
  ])('refuses $scenario with 400', async ({ payload }) => {
    expect((await ctx.call('owner', 'PUT', PATH, payload)).statusCode).toBe(400);
  });

  it('lists the caller rows with their video, newest first, a page at a time and by kind', async () => {
    await hideVideo(HIDDEN);
    await ctx.call('owner', 'PUT', PATH, { kind: 'hide_channel', channelId: await channelId() });
    await hideVideo(KEPT, 'stranger');

    const all = (await ctx.call('owner', 'GET', PATH)).json();
    const first = (await ctx.call('owner', 'GET', `${PATH}?limit=1`)).json();
    const rest = (
      await ctx.call('owner', 'GET', `${PATH}?limit=1&cursor=${first.nextCursor}`)
    ).json();
    const videos = (await ctx.call('owner', 'GET', `${PATH}?kind=not_interested`)).json();

    expect(all.items.map(({ kind }: { kind: string }) => kind)).toEqual([
      'hide_channel',
      'not_interested',
    ]);
    expect(all.items[0]).toMatchObject({ channel: { handle: 'creator' } });
    expect(all.items[1]).toMatchObject({ video: { id: HIDDEN }, channel: { handle: 'creator' } });
    expect(first.items).toHaveLength(1);
    expect(rest.items.map(({ id }: { id: string }) => id)).toEqual([all.items[1].id]);
    expect(videos.items).toHaveLength(1);
  });

  it('removes a row of the caller and answers 404 for another user own', async () => {
    const mine = (await hideVideo(HIDDEN)).json().id;
    const theirs = (await hideVideo(HIDDEN, 'stranger')).json().id;

    const refused = await ctx.call('owner', 'DELETE', `${PATH}/${theirs}`);
    const removed = await ctx.call('owner', 'DELETE', `${PATH}/${mine}`);

    expect(refused.statusCode).toBe(404);
    expect(refused.json().code).toBe(ErrorCodes.RECOMMENDATION_FEEDBACK_NOT_FOUND);
    expect(removed.statusCode).toBe(204);
    expect((await ctx.call('stranger', 'GET', PATH)).json().items).toHaveLength(1);
  });

  it('refuses an id that is not a UUID with 400', async () => {
    expect((await ctx.call('owner', 'DELETE', `${PATH}/nope`)).statusCode).toBe(400);
  });

  describe('where it applies', () => {
    it('drops the cached home page on a write and again on the undo', async () => {
      expect(await homeIds()).toContain(HIDDEN);

      const id = (await hideVideo(HIDDEN)).json().id;
      expect(await homeIds()).not.toContain(HIDDEN);

      await ctx.call('owner', 'DELETE', `${PATH}/${id}`);
      expect(await homeIds()).toContain(HIDDEN);
    });

    it('leaves the video in the feed, search and its own channel page, and out of related', async () => {
      await ctx.call('owner', 'PUT', PATH, { kind: 'hide_channel', channelId: await channelId() });

      const feed = (await ctx.call('owner', 'GET', '/v1/feed')).json().items;
      const search = (await ctx.call('owner', 'GET', '/v1/search?q=Clip&record=false')).json();
      const related = (await ctx.call('owner', 'GET', `/v1/videos/${HIDDEN}/related`)).json().items;

      expect(feed.map(({ id }: { id: string }) => id)).toContain(HIDDEN);
      expect(JSON.stringify(search)).toContain(HIDDEN);
      expect(related).toEqual([]);
      expect(await homeIds()).not.toContain(HIDDEN);
      expect(await homeIds('anonymous')).toContain(HIDDEN);
    });

    it('is the caller own, so another viewer still sees the video on their home', async () => {
      await hideVideo(HIDDEN, 'stranger');

      expect(await homeIds('owner')).toContain(HIDDEN);
    });
  });
});
