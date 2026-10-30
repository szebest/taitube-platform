import { mintToken } from '@vp/dev-token';
import { MAX_CAPTION_FILE_BYTES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { expectOk } from '@vp/testing/result';
import type { LightMyRequestResponse } from 'fastify';
import { bearer, buildTestApp, type TestApp } from '../../__tests__/test-app';
import {
  CAPTION_OWNER,
  CAPTION_STRANGER,
  CAPTIONED,
  PRIVATE_CAPTIONED,
  seedCaptionVideos,
  seedTrack,
  VTT,
} from '../../services/__tests__/caption-fixture';

const AS = {
  owner: bearer(mintToken({ sub: CAPTION_OWNER.id, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: CAPTION_STRANGER.id, role: 'USER', ttl: '1h' })),
  anonymous: {},
};

type Who = keyof typeof AS;
type Method = 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE';

const captions = (videoId: string, rest = '') => `/v1/videos/${videoId}/captions${rest}`;

describe('caption routes', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await buildTestApp();
    await seedCaptionVideos(ctx.repositories);
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  function call(
    who: Who,
    method: Method,
    url: string,
    payload?: Record<string, unknown> | string
  ): Promise<LightMyRequestResponse> {
    const type = typeof payload === 'string' ? { 'content-type': 'text/vtt' } : {};
    return ctx.app.inject({
      method,
      url,
      headers: { ...AS[who], ...type },
      ...(payload === undefined ? {} : { payload }),
    });
  }

  async function queuedRuns() {
    return expectOk(await ctx.repositories.outbox.claimBatch(20)).filter(
      (item) => item.kind === 'captions'
    );
  }

  const WRITES: { method: Method; url: string; payload?: Record<string, unknown> | string }[] = [
    { method: 'PATCH', url: captions(CAPTIONED), payload: { autoCaptions: true } },
    { method: 'PUT', url: captions(CAPTIONED, '/en'), payload: VTT },
    {
      method: 'PATCH',
      url: captions(CAPTIONED, '/en'),
      payload: { version: 1, cues: [{ index: 0, text: 'x' }] },
    },
    { method: 'DELETE', url: captions(CAPTIONED, '/en') },
    { method: 'POST', url: captions(CAPTIONED, '/generate'), payload: {} },
  ];

  it.each([
    ...WRITES,
    { method: 'PUT' as const, url: '/v1/me/channel/auto-captions', payload: { enabled: true } },
  ])('refuses an anonymous $method $url with 401', async ({ method, url, payload }) => {
    expect((await call('anonymous', method, url, payload)).statusCode).toBe(401);
  });

  it.each(WRITES)(
    'refuses a stranger $method $url on a video they can watch with 403',
    async ({ method, url, payload }) => {
      await seedTrack(ctx.repositories, {
        id: '00000000-0000-7000-8000-00000000cf01',
        kind: 'auto',
      });

      const res = await call('stranger', method, url, payload);

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe(ErrorCodes.FORBIDDEN);
    }
  );

  const HIDDEN = ErrorCodes.VIDEO_NOT_FOUND;

  it.each([
    {
      method: 'GET' as const,
      url: captions(PRIVATE_CAPTIONED),
      who: 'stranger' as const,
      code: HIDDEN,
    },
    {
      method: 'GET' as const,
      url: `/v1/videos/${PRIVATE_CAPTIONED}/transcript`,
      who: 'stranger' as const,
      code: HIDDEN,
    },
    {
      method: 'DELETE' as const,
      url: captions(PRIVATE_CAPTIONED, '/en'),
      who: 'stranger' as const,
      code: HIDDEN,
    },
    {
      method: 'GET' as const,
      url: `/v1/videos/${PRIVATE_CAPTIONED}/transcript`,
      who: 'anonymous' as const,
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])(
    'answers a $who $method on a private video $url with $code',
    async ({ method, url, who, code }) => {
      expect((await call(who, method, url)).json().code).toBe(code);
    }
  );

  it('lists only ready, switched-on tracks to a viewer and everything to the owner', async () => {
    await seedTrack(ctx.repositories, { id: '00000000-0000-7000-8000-00000000cf02', kind: 'auto' });
    expectOk(await ctx.repositories.captions.setAutoCaptions(CAPTIONED, false));
    expect((await call('owner', 'PUT', captions(CAPTIONED, '/de'), VTT)).statusCode).toBe(200);

    const viewer = (await call('anonymous', 'GET', captions(CAPTIONED))).json();
    const owner = (await call('owner', 'GET', captions(CAPTIONED))).json();

    expect(viewer).toEqual({
      tracks: [expect.objectContaining({ language: 'de', kind: 'uploaded', status: 'ready' })],
    });
    expect(owner.tracks.map((track: { language: string }) => track.language)).toEqual(['en', 'de']);
    expect(owner.settings).toEqual({ autoCaptions: false, channelDefault: false });
  });

  it('filters the transcript by the words asked for', async () => {
    await seedTrack(ctx.repositories, { id: '00000000-0000-7000-8000-00000000cf03', kind: 'auto' });

    const res = await call('anonymous', 'GET', `/v1/videos/${CAPTIONED}/transcript?q=bread`);

    expect(res.statusCode).toBe(200);
    expect(res.json().cues).toEqual([
      { index: 1, startMs: 1_500, endMs: 3_000, text: 'Today we bake bread' },
    ]);
  });

  it('answers a malformed file with 422 naming its line', async () => {
    const broken = 'WEBVTT\n\nnot a timing line\nhello\n';

    const res = await call('owner', 'PUT', captions(CAPTIONED, '/en'), broken);

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      errors: [{ field: 'body', line: 3 }],
    });
  });

  it('refuses an eleventh language with 409', async () => {
    for (const language of ['en', 'de', 'fr', 'es', 'it', 'pl', 'pt', 'nl', 'sv', 'ja']) {
      expect(
        (await call('owner', 'PUT', captions(CAPTIONED, `/${language}`), VTT)).statusCode
      ).toBe(200);
    }

    const res = await call('owner', 'PUT', captions(CAPTIONED, '/ko'), VTT);

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe(ErrorCodes.CAPTION_TRACK_LIMIT);
  });

  it('refuses a file over the size limit with 413', async () => {
    const huge = `WEBVTT\n\n${'x'.repeat(MAX_CAPTION_FILE_BYTES)}`;

    expect((await call('owner', 'PUT', captions(CAPTIONED, '/en'), huge)).statusCode).toBe(413);
  });

  it('asks before regenerating an edited track, then runs it', async () => {
    await seedTrack(ctx.repositories, {
      id: '00000000-0000-7000-8000-00000000cf04',
      kind: 'edited',
    });

    const unconfirmed = await call('owner', 'POST', captions(CAPTIONED, '/generate'), {});
    const confirmed = await call('owner', 'POST', captions(CAPTIONED, '/generate'), {
      overwrite: true,
    });

    expect(unconfirmed.statusCode).toBe(409);
    expect(unconfirmed.json().code).toBe(ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED);
    expect(confirmed.statusCode).toBe(202);
    expect(confirmed.json()).toMatchObject({ kind: 'auto', status: 'pending' });
    expect(await queuedRuns()).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ type: 'flow' }) }),
    ]);
  });

  it('starts one run when the switch turns on and keeps the track when it turns off', async () => {
    for (const autoCaptions of [true, true, false]) {
      expect((await call('owner', 'PATCH', captions(CAPTIONED), { autoCaptions })).statusCode).toBe(
        200
      );
    }

    expect(await queuedRuns()).toHaveLength(1);
    expect(expectOk(await ctx.repositories.captions.list(CAPTIONED))).toHaveLength(1);
    expect((await call('anonymous', 'GET', captions(CAPTIONED))).json().tracks).toEqual([]);
  });

  it('sets the channel default for the caller', async () => {
    const res = await call('owner', 'PUT', '/v1/me/channel/auto-captions', { enabled: true });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: true });
    expect(expectOk(await ctx.repositories.captions.settings(CAPTIONED))?.channelDefault).toBe(
      true
    );
  });
});
