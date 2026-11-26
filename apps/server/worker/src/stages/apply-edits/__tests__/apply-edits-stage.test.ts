import { expectErr, expectOk } from '@kit/testing/result';
import type { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes, PermanentError } from '@vp/errors';
import type { ApplyEditsOptions, MediaTools } from '@vp/ffmpeg';
import { APPLY_EDITS, type ApplyEditsJob, CANONICAL_LADDER } from '@vp/job-contracts';
import { masterPlaylistKey, renditionObjectKey, renditionPlaylistKey } from '@vp/storage';
import { encodeSegments, flowWorld, OWNER_ID, probed } from '../../../__tests__/flow-harness';
import { STAGE_SETTINGS } from '../../../__tests__/stage-settings';
import { createApplyEditsProcessor } from '../apply-edits-stage';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000f1';
const LADDER = [CANONICAL_LADDER[1], CANONICAL_LADDER[2]];
const CHAPTERS = [0, 60_000, 120_000, 180_000].map((startMs) => ({
  startMs,
  title: `at ${startMs}`,
}));

describe('worker: apply-edits stage', () => {
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let renders: ApplyEditsOptions[];
  let media: MediaTools;

  const job = (generation: number, attemptsMade = 0) => ({
    id: `${VIDEO_ID}--apply-edits--g${generation}`,
    name: APPLY_EDITS,
    data: { videoId: VIDEO_ID, generation, traceparent: 't' } satisfies ApplyEditsJob,
    attemptsMade,
  });
  const run = (generation: number, attemptsMade = 0) =>
    createApplyEditsProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      media,
      logger: flowWorld().logger,
      tmpDir: STAGE_SETTINGS.tmpDir,
      now: () => Date.parse('2026-03-01T12:00:00.000Z'),
    })(job(generation, attemptsMade));
  const video = async () => {
    const found = expectOk(await repositories.videos.findById(VIDEO_ID));
    if (!found) throw new Error('seeded video is gone');
    return { ...found };
  };
  const publicKeys = async () =>
    expectOk(await storage.listObjects({ bucket: 'public', prefix: `videos/${VIDEO_ID}/` })).keys;
  const replacedEvents = async () =>
    expectOk(await repositories.events.findByVideoId(VIDEO_ID)).filter(
      ({ type }) => type === 'video.replaced'
    );
  const put = (bucket: string, key: string) =>
    storage.uploadObject({ bucket, key, body: key, contentType: 'application/octet-stream' });
  const outbox = {
    kind: APPLY_EDITS,
    payload: { type: 'pubsub', channel: 'x', message: '' },
  } as const;

  async function replacement() {
    const sourceKey = `raw/${VIDEO_ID}/g2/source.mov`;
    expectOk(await put('raw', sourceKey));
    expectOk(
      await repositories.videoGenerations.openReplacement({
        videoId: VIDEO_ID,
        generation: 2,
        replacesGeneration: 1,
        sourceKey,
        uploadExpiresAt: new Date(Date.parse('2026-03-02T00:00:00.000Z')),
      })
    );
    expectOk(await repositories.videoGenerations.startRender(VIDEO_ID, 2, outbox));
  }

  beforeEach(async () => {
    const world = flowWorld();
    repositories = world.repositories;
    storage = world.storage;
    renders = [];
    media = {
      ...STAGE_SETTINGS.media,
      probe: async () => probed({ width: 1280, height: 720, durationMs: 240_000 }, LADDER),
      applyEdits: async (options) => {
        renders.push(options);
        return encodeSegments(options, 2);
      },
    };
    expectOk(
      await repositories.videos.create({
        id: VIDEO_ID,
        ownerId: OWNER_ID,
        channelId: '00000000-0000-7000-8000-00000000c4a1',
        sourceKey: `raw/${VIDEO_ID}/source.mp4`,
        status: 'READY',
        durationMs: 240_000,
        width: 1280,
        height: 720,
        masterPlaylistKey: masterPlaylistKey(VIDEO_ID),
        ladder: LADDER,
      })
    );
    for (const rung of LADDER) {
      expectOk(await put('public', renditionObjectKey(VIDEO_ID, rung.name, 'seg_00001.ts')));
      expectOk(await put('public', renditionPlaylistKey(VIDEO_ID, rung.name)));
    }
    repositories.videoChapters.replace(VIDEO_ID, CHAPTERS);
  });

  it('renders a replacement beside the playing generation and swaps it in once its master is up', async () => {
    await replacement();
    const before = await video();

    expect(expectOk(await run(2))).toEqual({ outcome: 'swapped' });

    expect(renders.map(({ rendition }) => rendition.name)).toEqual(['720p', '480p']);
    expect(renders.every(({ edits }) => edits.trim === null && edits.blurs.length === 0)).toBe(
      true
    );
    expect(await video()).toMatchObject({
      generation: 2,
      version: before.version + 1,
      masterPlaylistKey: masterPlaylistKey(VIDEO_ID, 2),
      viewsCount: before.viewsCount,
      likesCount: before.likesCount,
      commentsCount: before.commentsCount,
    });
    const keys = await publicKeys();
    expect(keys).toContain(masterPlaylistKey(VIDEO_ID, 2));
    expect(keys).toContain(renditionPlaylistKey(VIDEO_ID, '720p', 2));
    expect(keys).toContain(renditionPlaylistKey(VIDEO_ID, '720p'));
    expect(keys).toContain(renditionObjectKey(VIDEO_ID, '720p', 'seg_00001.ts'));
  });

  it('swaps once when the job runs again after it swapped', async () => {
    await replacement();
    expectOk(await run(2));
    const swapped = await video();

    expect(expectOk(await run(2, 1))).toEqual({ outcome: 'not-rendering' });
    expect(await video()).toEqual(swapped);
    expect(await replacedEvents()).toHaveLength(1);
  });

  it('leaves the video untouched when a rendition fails, and says why', async () => {
    await replacement();
    const before = await video();
    media.applyEdits = async () => {
      throw new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'no decoder');
    };

    expect(expectErr(await run(2)).code).toBe(ErrorCodes.UNSUPPORTED_CODEC);
    expect(await video()).toEqual(before);
    expect(await replacedEvents()).toHaveLength(0);
    expect(await publicKeys()).not.toContain(masterPlaylistKey(VIDEO_ID, 2));
  });

  it('fails the generation instead of swapping when the video moved on meanwhile', async () => {
    await replacement();
    expectOk(await repositories.videos.transition({ videoId: VIDEO_ID, edge: 'reprocess' }));

    expect(expectOk(await run(2))).toEqual({ outcome: 'superseded' });
    const [row] = expectOk(await repositories.videoGenerations.list(VIDEO_ID));
    expect(row).toMatchObject({ generation: 2, status: 'failed', errorCode: 'VERSION_CONFLICT' });
    expect((await video()).generation).toBe(1);
  });

  it('renders an edit from the base top rendition through its list and shifts the chapters', async () => {
    const edits = {
      trim: { startMs: 30_000, endMs: 240_000 },
      blurs: [
        {
          startMs: 40_000,
          endMs: 50_000,
          shape: 'rect',
          x: 0.1,
          y: 0.1,
          w: 0.2,
          h: 0.2,
          strength: 10,
        },
      ] as const,
    };
    expectOk(
      await repositories.videoGenerations.saveEdit({
        videoId: VIDEO_ID,
        generation: 2,
        baseGeneration: 1,
        replacesGeneration: 1,
        edit: { trim: edits.trim, blurs: [...edits.blurs] },
        outbox,
      })
    );

    expect(expectOk(await run(2))).toEqual({ outcome: 'swapped' });

    expect(renders.map(({ sourcePath }) => sourcePath.endsWith('index.m3u8'))).toEqual([
      true,
      true,
    ]);
    expect(renders[0]?.edits).toEqual({ trim: edits.trim, blurs: edits.blurs });
    expect(await video()).toMatchObject({ generation: 2, durationMs: 210_000 });
    expect(repositories.videoChapters.chaptersOf(VIDEO_ID).map(({ startMs }) => startMs)).toEqual([
      0, 30_000, 90_000, 150_000,
    ]);
  });
});
