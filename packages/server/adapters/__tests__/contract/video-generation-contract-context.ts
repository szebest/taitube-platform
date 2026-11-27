import { expectOk } from '@kit/testing/result';
import type { NewOutboxInput, SwapOutcome, VideoGenerationRepository } from '@vp/core/repositories';
import type { GenerationPlayback } from '@vp/domain';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { viewBatch } from './view-batch';

export const VIDEO = VIDEO_IDS.a;
export const TOKEN = '00000000-0000-7000-8000-0000000000e1';
export const NOW = new Date('2026-03-01T12:00:00.000Z');
export const CHAPTERS = [0, 60_000, 120_000, 180_000].map((startMs) => ({
  startMs,
  title: `at ${startMs}`,
}));

export const outboxRow = (generation: number): NewOutboxInput => ({
  kind: 'apply-edits',
  payload: {
    type: 'queue',
    queueName: 'transcode-1080p',
    job: { name: 'apply-edits', data: { generation } },
  },
});

export const playback = (generation: number, durationMs = 240_000): GenerationPlayback => ({
  masterPlaylistKey: `videos/${VIDEO}/hls/g${generation}/master.m3u8`,
  durationMs,
  width: 1280,
  height: 720,
  fps: 30,
  ladder: [{ name: '720p' }],
});

export interface VideoGenerationContractContext {
  readonly subject: RepositoriesSubject;
  readonly generations: VideoGenerationRepository;
}

/** Registers the hooks of a contract file and returns the context they fill. */
export function videoGenerationContractContext(
  makeSubject: MakeRepositoriesSubject
): VideoGenerationContractContext {
  let subject: RepositoriesSubject;
  const ctx: VideoGenerationContractContext = {
    get subject() {
      return subject;
    },
    get generations() {
      return subject.repositories.videoGenerations;
    },
  };

  beforeAll(async () => {
    subject = await makeSubject();
  });

  afterAll(async () => {
    await subject.close();
  });

  beforeEach(async () => {
    await subject.reset();
    await seedOwners(subject.repositories);
    await subject.seedVideo(
      publicVideo({
        id: VIDEO,
        durationMs: 240_000,
        masterPlaylistKey: `videos/${VIDEO}/hls/master.m3u8`,
        ladder: [{ name: '720p' }],
        viewsCount: 1_234,
        likesCount: 56,
        commentsCount: 7,
      })
    );
    expectOk(
      await subject.repositories.videoStudio.updateMetadata({
        videoId: VIDEO,
        expectedVersion: (await video(ctx)).version,
        patch: { chapters: CHAPTERS },
        userId: OWNER_ID,
        auditFields: [],
      })
    );
  });

  return ctx;
}

export async function video(ctx: VideoGenerationContractContext) {
  const found = expectOk(await ctx.subject.repositories.videos.findById(VIDEO));
  if (!found) throw new Error('seeded video is gone');
  return { ...found };
}

export async function rowOf(ctx: VideoGenerationContractContext, generation: number) {
  return expectOk(await ctx.generations.list(VIDEO)).find((row) => row.generation === generation);
}

export async function chaptersOf(ctx: VideoGenerationContractContext) {
  return expectOk(await ctx.subject.repositories.videoChapters.listFor([VIDEO])).get(VIDEO);
}

export async function curveOf(ctx: VideoGenerationContractContext) {
  return expectOk(await ctx.subject.repositories.videoViews.retentionCurve(VIDEO));
}

export async function seedRetention(ctx: VideoGenerationContractContext): Promise<void> {
  expectOk(
    await ctx.subject.repositories.videoViews.applyBatch(
      viewBatch({ retention: [{ videoId: VIDEO, percent: 0, viewers: 7 }] })
    )
  );
}

export async function render(
  ctx: VideoGenerationContractContext,
  generation: number,
  durationMs?: number
): Promise<SwapOutcome> {
  expectOk(await ctx.generations.claim(VIDEO, generation, TOKEN));
  return expectOk(
    await ctx.generations.swap({
      videoId: VIDEO,
      generation,
      claim: { type: 'render', lockToken: TOKEN, playback: playback(generation, durationMs) },
      now: NOW,
    })
  );
}

export async function edit(
  ctx: VideoGenerationContractContext,
  generation: number,
  baseGeneration = 1
): Promise<boolean> {
  return expectOk(
    await ctx.generations.saveEdit({
      videoId: VIDEO,
      generation,
      baseGeneration,
      replacesGeneration: (await video(ctx)).generation,
      edit: { trim: { startMs: 30_000, endMs: 240_000 }, blurs: [] },
      outbox: outboxRow(generation),
    })
  );
}
