import { expectOk } from '@kit/testing/result';
import { mintToken } from '@vp/dev-identity';
import { ErrorCodes } from '@vp/errors';
import { masterPlaylistKey, replacementSourceKey } from '@vp/storage';
import {
  type TestApp,
  bearer,
  buildTestApp,
  seedTeamMember,
  seedVideo,
} from '../../__tests__/test-app';

const OWNER = '11111111-1111-7111-8111-1111111111d1';
const EDITOR = '22222222-2222-7222-8222-2222222222d2';
const MODERATOR = '33333333-3333-7333-8333-3333333333d3';
const STRANGER = '44444444-4444-7444-8444-4444444444d4';
const VIDEO = '66666666-6666-7666-8666-6666666666d6';
const PRIVATE = '77777777-7777-7777-8777-7777777777d7';
const DURATION = 240_000;
const LADDER = [{ name: '720p', width: 1280, height: 720 }];

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'CREATOR', ttl: '1h' })),
  editor: bearer(mintToken({ sub: EDITOR, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  anonymous: {},
};
type Who = keyof typeof AS;

const FILE = { filename: 'take-two.mp4', sizeBytes: 1_000, contentType: 'video/mp4' };
const TRIM = { trim: { startMs: 10_000, endMs: 200_000 }, blurs: [] };

describe('replace, trim and clip suggestion routes', () => {
  let ctx: TestApp;

  const call = (who: Who, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    ctx.app.inject({ method, url, headers: AS[who], ...(payload ? { payload } : {}) });
  const generations = async (videoId = VIDEO) =>
    (await call('owner', 'GET', `/v1/creator/videos/${videoId}/generations`)).json();
  const video = async () => expectOk(await ctx.repositories.videos.findById(VIDEO));
  const uploadReplacement = async (generation: number) =>
    expectOk(
      await ctx.storage.uploadObject({
        bucket: 'raw',
        key: replacementSourceKey(VIDEO, generation, '.mp4'),
        body: 'bytes',
        contentType: 'video/mp4',
      })
    );
  const renderEdit = async (generation: number) => {
    expectOk(await ctx.repositories.videoGenerations.claim(VIDEO, generation, 'token'));
    expectOk(
      await ctx.repositories.videoGenerations.swap({
        videoId: VIDEO,
        generation,
        claim: {
          type: 'render',
          lockToken: 'token',
          playback: {
            masterPlaylistKey: masterPlaylistKey(VIDEO, generation),
            durationMs: 190_000,
            width: 1280,
            height: 720,
            fps: 30,
            ladder: LADDER,
          },
        },
        now: new Date(),
      })
    );
  };

  beforeAll(async () => {
    ctx = await buildTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    ctx.repositories.clear();
    ctx.cache.clear();
    const playable = {
      ownerId: OWNER,
      durationMs: DURATION,
      masterPlaylistKey: masterPlaylistKey(VIDEO),
      ladder: LADDER,
    };
    await seedVideo(ctx.repositories, { id: VIDEO, ...playable });
    await seedVideo(ctx.repositories, { id: PRIVATE, ...playable, visibility: 'private' });
    await seedTeamMember(ctx.repositories, { ownerId: OWNER, memberId: EDITOR, role: 'editor' });
    await seedTeamMember(ctx.repositories, {
      ownerId: OWNER,
      memberId: MODERATOR,
      role: 'moderator',
    });
  });

  it('hands out an upload into a new generation and renders it once the file landed, one at a time', async () => {
    const started = await call('owner', 'POST', `/v1/videos/${VIDEO}/replacement`, FILE);
    const { generation } = started.json();
    const early = await call('owner', 'POST', `/v1/videos/${VIDEO}/replacement/complete`, {
      generation,
    });
    await uploadReplacement(generation);
    const completed = await call('owner', 'POST', `/v1/videos/${VIDEO}/replacement/complete`, {
      generation,
    });
    const second = await call('owner', 'POST', `/v1/videos/${VIDEO}/replacement`, FILE);

    expect([started.statusCode, generation]).toEqual([201, 2]);
    expect(started.json().uploadUrl).toEqual(expect.any(String));
    expect([early.statusCode, early.json().code]).toEqual([
      409,
      ErrorCodes.REPLACEMENT_NOT_UPLOADED,
    ]);
    expect([completed.statusCode, completed.json()]).toEqual([
      202,
      { generation: 2, status: 'rendering' },
    ]);
    expect([second.statusCode, second.json().code]).toEqual([
      409,
      ErrorCodes.GENERATION_IN_PROGRESS,
    ]);
    expect(await video()).toMatchObject({ status: 'READY', generation: 1 });
    expect((await generations()).items).toEqual([
      expect.objectContaining({ generation: 2, kind: 'replacement', status: 'rendering' }),
    ]);
  });

  it.each([
    {
      scenario: 'a type the pipeline does not take',
      file: { ...FILE, contentType: 'text/plain' },
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
    {
      scenario: 'a file past the upload limit',
      file: { ...FILE, sizeBytes: Number.MAX_SAFE_INTEGER },
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
  ])('refuses $scenario before anything is opened', async ({ file, code }) => {
    const res = await call('owner', 'POST', `/v1/videos/${VIDEO}/replacement`, file);

    expect([res.statusCode, res.json().code]).toEqual([422, code]);
    expect((await generations()).items).toEqual([]);
  });

  it('saves an edit over the base, refuses one outside it, and reverts only the playing edit', async () => {
    const outside = await call('owner', 'PUT', `/v1/videos/${VIDEO}/edits`, {
      trim: { startMs: 0, endMs: DURATION + 1 },
      blurs: [],
    });
    const early = await call('owner', 'POST', `/v1/videos/${VIDEO}/edits/revert`, { version: 0 });
    const saved = await call('owner', 'PUT', `/v1/videos/${VIDEO}/edits`, TRIM);
    await renderEdit(2);
    const edited = await video();
    const stale = await call('owner', 'POST', `/v1/videos/${VIDEO}/edits/revert`, {
      version: (edited?.version ?? 0) - 1,
    });
    const reverted = await call('owner', 'POST', `/v1/videos/${VIDEO}/edits/revert`, {
      version: edited?.version,
    });

    expect([outside.statusCode, outside.json().code]).toEqual([422, ErrorCodes.VALIDATION_FAILED]);
    expect([early.statusCode, early.json().code]).toEqual([409, ErrorCodes.NO_EDIT_TO_REVERT]);
    expect([saved.statusCode, saved.json()]).toMatchObject([
      202,
      { baseGeneration: 1, generation: 2, status: 'rendering', trim: TRIM.trim },
    ]);
    expect([stale.statusCode, stale.json().code]).toEqual([409, ErrorCodes.VERSION_CONFLICT]);
    expect([reverted.statusCode, reverted.json().generation]).toEqual([200, 1]);
    expect(await video()).toMatchObject({ generation: 1, durationMs: DURATION });
    expect((await generations()).edit).toMatchObject({ status: 'reverted', baseGeneration: 1 });
  });

  it('suggests clips inside the video, and one becomes a normal clip', async () => {
    expectOk(
      await ctx.repositories.videoViews.applyBatch({
        batchId: 'b1',
        counts: [],
        hourly: [],
        devices: [],
        shareLinks: [],
        experiments: [],
        playlists: [],
        retention: [0, 25, 50, 75, 100].map((percent, step) => ({
          videoId: VIDEO,
          percent,
          viewers: [100, 60, 58, 30, 10][step] ?? 0,
        })),
      })
    );

    const suggested = await call('editor', 'GET', `/v1/creator/videos/${VIDEO}/clip-suggestions`);
    const [first] = suggested.json().items;
    const clip = await call('editor', 'POST', `/v1/videos/${VIDEO}/clips`, {
      startMs: first.startMs,
      endMs: first.endMs,
      title: 'The good part',
    });

    expect(suggested.statusCode).toBe(200);
    expect(suggested.json().items.length).toBeGreaterThan(0);
    for (const item of suggested.json().items) {
      expect(item.startMs).toBeGreaterThanOrEqual(0);
      expect(item.endMs).toBeLessThanOrEqual(DURATION);
    }
    expect([clip.statusCode, clip.json()]).toMatchObject([
      201,
      { videoId: VIDEO, startMs: first.startMs, endMs: first.endMs },
    ]);
  });

  it.each([
    { who: 'editor' as const, videoId: VIDEO, status: [201, 202, 200, 200] },
    { who: 'moderator' as const, videoId: VIDEO, status: [403, 403, 403, 403] },
    { who: 'stranger' as const, videoId: PRIVATE, status: [404, 404, 404, 404] },
    { who: 'anonymous' as const, videoId: VIDEO, status: [401, 401, 401, 401] },
  ])(
    'answers $who with $status for replace, edit, generations and clip suggestions',
    async ({ who, videoId, status }) => {
      const replaced = await call(who, 'POST', `/v1/videos/${videoId}/replacement`, FILE);
      if (replaced.statusCode === 201) {
        expectOk(await ctx.repositories.videoGenerations.fail(videoId, 2, 'ABORTED'));
      }
      const edited = await call(who, 'PUT', `/v1/videos/${videoId}/edits`, TRIM);
      const listed = await call(who, 'GET', `/v1/creator/videos/${videoId}/generations`);
      const suggested = await call(who, 'GET', `/v1/creator/videos/${videoId}/clip-suggestions`);

      expect([replaced, edited, listed, suggested].map((res) => res.statusCode)).toEqual(status);
    }
  );
});
