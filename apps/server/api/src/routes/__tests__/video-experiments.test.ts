import { expectOk } from '@kit/testing/result';
import { mintToken } from '@vp/dev-identity';
import { EXPERIMENT_MIN_IMPRESSIONS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import {
  type TestApp,
  bearer,
  buildTestApp,
  seedTeamMember,
  seedVideo,
} from '../../__tests__/test-app';
import { sessionShown } from '../../services/__tests__/running-test';

const OWNER = '11111111-1111-7111-8111-1111111111c1';
const EDITOR = '22222222-2222-7222-8222-2222222222c2';
const MODERATOR = '33333333-3333-7333-8333-3333333333c3';
const STRANGER = '44444444-4444-7444-8444-4444444444c4';
const VIDEO = '66666666-6666-7666-8666-6666666666c6';
const PRIVATE = '77777777-7777-7777-8777-7777777777c7';
const NO_TEST = '99999999-9999-7999-8999-9999999999c9';
const WEB = 'http://localhost:5173';

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' })),
  editor: bearer(mintToken({ sub: EDITOR, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  anonymous: {},
};
type Who = keyof typeof AS;

const TITLES = { kind: 'title', variants: [{ title: 'Control' }, { title: 'Challenger' }] };

describe('title and thumbnail test routes', () => {
  let ctx: TestApp;

  const call = (
    who: Who,
    method: 'GET' | 'POST',
    url: string,
    options: { payload?: object; session?: string } = {}
  ) =>
    ctx.app.inject({
      method,
      url,
      headers: {
        ...AS[who],
        ...(options.session ? { 'x-viewer-session': options.session } : {}),
      },
      ...(options.payload ? { payload: options.payload } : {}),
    });
  const testsUrl = (videoId = VIDEO) => `/v1/creator/videos/${videoId}/experiments`;
  const start = async (videoId = VIDEO) =>
    (await call('owner', 'POST', testsUrl(videoId), { payload: TITLES })).json();
  const version = async (videoId = VIDEO) =>
    expectOk(await ctx.repositories.videos.findById(videoId))?.version ?? -1;

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.repositories.clear();
    ctx.cache.clear();
    await seedVideo(ctx.repositories, { id: VIDEO, ownerId: OWNER, title: 'Control' });
    await seedVideo(ctx.repositories, {
      id: PRIVATE,
      ownerId: OWNER,
      title: 'Control',
      visibility: 'private',
    });
    await seedTeamMember(ctx.repositories, { ownerId: OWNER, memberId: EDITOR, role: 'editor' });
    await seedTeamMember(ctx.repositories, {
      ownerId: OWNER,
      memberId: MODERATOR,
      role: 'moderator',
    });
  });

  it('gives one session the same variant on the feed and the watch read, and tags both', async () => {
    const test = await start();
    const session = sessionShown(test.id, 'b');

    const feed = await call('anonymous', 'GET', '/v1/feed', { session });
    const watched = await call('anonymous', 'GET', `/v1/videos/${VIDEO}`, { session });
    const card = feed.json().items.find(({ id }: { id: string }) => id === VIDEO);
    const shown = { title: 'Challenger', experiment: { id: test.id, variantId: 'b' } };

    expect(card).toMatchObject(shown);
    expect(watched.json()).toMatchObject(shown);
    expect(feed.headers['cache-control']).toMatch(/^private,/);
    expect(feed.headers.vary).toBe('Authorization, x-viewer-session');
  });

  it('serves the control and no tag without a session header, or with a malformed one', async () => {
    await start();

    for (const session of [undefined, 'short']) {
      const watched = (await call('anonymous', 'GET', `/v1/videos/${VIDEO}`, { session })).json();

      expect(watched.title).toBe('Control');
      expect(watched).not.toHaveProperty('experiment');
    }
  });

  it('keeps oEmbed on the control while a test runs', async () => {
    const test = await start();
    const url = encodeURIComponent(`${WEB}/watch/${VIDEO}`);

    const res = await call('anonymous', 'GET', `/v1/oembed?url=${url}`, {
      session: sessionShown(test.id, 'b'),
    });

    expect(res.json().title).toBe('Control');
  });

  it('says not enough data under 1000 impressions a variant', async () => {
    await start();

    const [listed] = (await call('editor', 'GET', testsUrl())).json().items;

    expect(listed.results).toEqual({
      enoughData: false,
      variants: ['a', 'b'].map((variantId) =>
        expect.objectContaining({ variantId, watchSecondsPerImpression: null, clickThrough: null })
      ),
    });
  });

  it('applies nothing on its own when every variant has enough data and one clearly leads', async () => {
    const test = await start();
    const before = await version();
    ctx.repositories.videoExperiments.addStats(
      [
        { variantId: 'a' as const, starts: 100, watchSeconds: 1_000 },
        { variantId: 'b' as const, starts: 700, watchSeconds: 20_000 },
      ].map((row) => ({
        ...row,
        experimentId: test.id,
        viewDate: '2026-11-20' as const,
        impressions: EXPERIMENT_MIN_IMPRESSIONS,
      }))
    );

    const [listed] = (await call('owner', 'GET', testsUrl())).json().items;

    expect(listed).toMatchObject({ status: 'running', results: { enoughData: true } });
    expect(expectOk(await ctx.repositories.videos.findById(VIDEO))).toMatchObject({
      title: 'Control',
      version: before,
    });
  });

  it('applies the winner an editor picks under the version, and refuses a stale one', async () => {
    const test = await start();
    const applyUrl = `${testsUrl()}/${test.id}/apply`;

    const stale = await call('editor', 'POST', applyUrl, {
      payload: { variantId: 'b', version: 0 },
    });
    const applied = await call('editor', 'POST', applyUrl, {
      payload: { variantId: 'b', version: await version() },
    });
    const again = await call('editor', 'POST', applyUrl, {
      payload: { variantId: 'a', version: await version() },
    });

    expect([stale.statusCode, stale.json().code]).toEqual([409, ErrorCodes.VERSION_CONFLICT]);
    expect([applied.statusCode, applied.json().title]).toEqual([200, 'Challenger']);
    expect([again.statusCode, again.json().code]).toEqual([409, ErrorCodes.EXPERIMENT_NOT_RUNNING]);
  });

  it('answers 404 EXPERIMENT_NOT_FOUND for a test the video does not run', async () => {
    const res = await call('owner', 'POST', `${testsUrl()}/${NO_TEST}/stop`);

    expect([res.statusCode, res.json().code]).toEqual([404, ErrorCodes.EXPERIMENT_NOT_FOUND]);
  });

  it.each([
    { who: 'editor' as const, videoId: VIDEO, status: [201, 200, 200, 200] },
    { who: 'moderator' as const, videoId: VIDEO, status: [403, 403, 403, 403] },
    { who: 'stranger' as const, videoId: PRIVATE, status: [404, 404, 404, 404] },
    { who: 'anonymous' as const, videoId: VIDEO, status: [401, 401, 401, 401] },
  ])(
    'answers $who with $status for create, list, stop and apply',
    async ({ who, videoId, status }) => {
      const running = async () => {
        const items: { id: string; status: string }[] = (
          await call('owner', 'GET', testsUrl(videoId))
        ).json().items;
        const id = items.find((item) => item.status === 'running')?.id ?? (await start(videoId)).id;
        return `${testsUrl(videoId)}/${id}`;
      };
      await call('owner', 'POST', `${await running()}/stop`);

      const created = await call(who, 'POST', testsUrl(videoId), { payload: TITLES });
      const listed = await call(who, 'GET', testsUrl(videoId));
      const stopped = await call(who, 'POST', `${await running()}/stop`);
      const applied = await call(who, 'POST', `${await running()}/apply`, {
        payload: { variantId: 'a', version: await version(videoId) },
      });

      expect([created, listed, stopped, applied].map((res) => res.statusCode)).toEqual(status);
    }
  );
});
