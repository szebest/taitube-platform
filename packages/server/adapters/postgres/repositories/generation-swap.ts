import type { SwapGenerationInput, SwapOutcome } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  EDIT_BASE_RETENTION_MS,
  type GenerationPlayback,
  type GenerationTimeline,
  RETIRED_GENERATION_GRACE_MS,
  drifted,
  shiftTimeline,
  videoGenerationUpdated,
} from '@vp/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';
import { replaceChapters, selectChapters } from './video-revision-writes';

const {
  videos: v,
  videoEvents: ve,
  videoGenerations: vg,
  videoEdits: ved,
  videoCorrections: vco,
  videoRetentionMilestones: vrm,
} = schema;

type VideoRow = typeof v.$inferSelect;
type GenerationRow = typeof vg.$inferSelect;

function playbackOf(video: VideoRow): GenerationPlayback | null {
  if (!video.masterPlaylistKey || video.durationMs === null) return null;
  return {
    masterPlaylistKey: video.masterPlaylistKey,
    durationMs: video.durationMs,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: video.fps,
    ladder: video.ladder,
  };
}

async function timelineOf(tx: PostgresDatabase, videoId: string): Promise<GenerationTimeline> {
  const corrections = await tx
    .select({ startMs: vco.startMs, endMs: vco.endMs, text: vco.text })
    .from(vco)
    .where(eq(vco.videoId, videoId))
    .orderBy(asc(vco.startMs));
  return { chapters: await selectChapters(tx, videoId), corrections };
}

async function writeTimeline(
  tx: PostgresDatabase,
  videoId: string,
  timeline: GenerationTimeline,
  now: Date
): Promise<void> {
  await replaceChapters(tx, videoId, timeline.chapters);
  await tx.delete(vco).where(eq(vco.videoId, videoId));
  if (timeline.corrections.length === 0) return;
  await tx
    .insert(vco)
    .values(timeline.corrections.map((c) => ({ ...c, id: uuidv7(), videoId, createdAt: now })));
}

async function swapRetention(
  tx: PostgresDatabase,
  videoId: string,
  restored: GenerationRow['retention']
) {
  const held = await tx
    .select({ percent: vrm.percent, viewers: vrm.viewers })
    .from(vrm)
    .where(eq(vrm.videoId, videoId))
    .orderBy(asc(vrm.percent));
  await tx.delete(vrm).where(eq(vrm.videoId, videoId));
  if (restored?.length) await tx.insert(vrm).values(restored.map((p) => ({ ...p, videoId })));
  return held;
}

/** The timeline the incoming generation plays with; `null` keeps the one the video has. */
async function incomingTimeline(
  tx: PostgresDatabase,
  incoming: GenerationRow,
  input: SwapGenerationInput
): Promise<GenerationTimeline | null> {
  if (input.claim.type === 'revert') return incoming.timeline;
  if (incoming.kind !== 'edit' || incoming.baseGeneration === null) return null;
  const [base] = await tx
    .select({ timeline: vg.timeline })
    .from(vg)
    .where(and(eq(vg.videoId, input.videoId), eq(vg.generation, incoming.baseGeneration)));
  const [edit] = await tx
    .select({ trim: ved.trim })
    .from(ved)
    .where(eq(ved.videoId, input.videoId));
  return base?.timeline ? shiftTimeline(base.timeline, edit?.trim ?? null) : null;
}

/**
 * The one compare-and-set a swap is, on the caller's transaction: the video points at the incoming
 * generation and bumps its version, the outgoing generation keeps what it played with (playback,
 * chapters, corrections, retention) for a swap back, and `video.replaced` is appended.
 */
export async function commitGenerationSwap(
  tx: PostgresDatabase,
  input: SwapGenerationInput
): Promise<SwapOutcome> {
  const { videoId, generation, claim, now } = input;
  const held =
    claim.type === 'render'
      ? and(eq(vg.status, 'rendering'), eq(vg.lockToken, claim.lockToken))
      : eq(vg.status, 'retired');
  const [incoming] = await tx
    .select()
    .from(vg)
    .where(and(eq(vg.videoId, videoId), eq(vg.generation, generation), held))
    .for('update');
  if (!incoming) return { type: 'fenced' };

  const [video] = await tx
    .select()
    .from(v)
    .where(and(eq(v.id, videoId), eq(v.status, 'READY')))
    .for('update');
  const current =
    claim.type === 'render'
      ? video?.generation === incoming.replacesGeneration
      : video?.version === claim.expectedVersion;
  const playback = claim.type === 'render' ? claim.playback : incoming.playback;
  if (!video || !current || !playback) return { type: 'superseded' };

  const outgoing = video.generation;
  const keepsBase = incoming.kind === 'edit' && claim.type === 'render';
  const outgoingPurge = new Date(
    now.getTime() +
      (keepsBase && outgoing === incoming.baseGeneration
        ? EDIT_BASE_RETENTION_MS
        : RETIRED_GENERATION_GRACE_MS)
  );
  const timeline = await timelineOf(tx, videoId);
  const retired = {
    status: 'retired' as const,
    playback: playbackOf(video),
    timeline,
    retention: await swapRetention(
      tx,
      videoId,
      claim.type === 'revert' ? incoming.retention : null
    ),
    purgeAfter: outgoingPurge,
    updatedAt: now,
  };
  await tx
    .insert(vg)
    .values({
      ...retired,
      videoId,
      generation: outgoing,
      kind: 'upload',
      replacesGeneration: outgoing,
      createdAt: now,
    })
    .onConflictDoUpdate({ target: [vg.videoId, vg.generation], set: retired });
  if (keepsBase && incoming.baseGeneration !== null) {
    await tx
      .update(vg)
      .set({ purgeAfter: new Date(now.getTime() + EDIT_BASE_RETENTION_MS), updatedAt: now })
      .where(and(eq(vg.videoId, videoId), eq(vg.generation, incoming.baseGeneration)));
  }

  const restoredTimeline = await incomingTimeline(tx, incoming, input);
  if (restoredTimeline) await writeTimeline(tx, videoId, restoredTimeline, now);

  const [swapped] = await tx
    .update(v)
    .set({ ...playback, generation, version: sql`${v.version} + 1`, updatedAt: now })
    .where(eq(v.id, videoId))
    .returning({ version: v.version });
  await tx
    .update(vg)
    .set({
      status: 'active',
      lockToken: null,
      purgeAfter: null,
      playback,
      needsReview:
        incoming.kind === 'replacement' && drifted(video.durationMs, playback.durationMs),
      updatedAt: now,
    })
    .where(and(eq(vg.videoId, videoId), eq(vg.generation, generation)));
  if (incoming.kind === 'edit' || claim.type === 'revert') {
    await tx
      .update(ved)
      .set({ status: claim.type === 'revert' ? 'reverted' : 'applied', updatedAt: now })
      .where(eq(ved.videoId, videoId));
  }
  await tx.insert(ve).values({
    videoId,
    type: 'video.replaced',
    payload: {
      generation,
      previousGeneration: outgoing,
      kind: claim.type === 'revert' ? 'revert' : incoming.kind,
    },
    createdAt: now,
  });
  await appendUserEvent(tx, {
    userId: video.ownerId,
    ...videoGenerationUpdated({ videoId, generation, status: 'active' }),
  });
  return { type: 'swapped', version: swapped?.version ?? video.version + 1 };
}
