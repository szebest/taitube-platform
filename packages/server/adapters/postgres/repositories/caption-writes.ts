import type { CaptionRecord, CaptionSettings } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { TranscriptCue, UserEvent } from '@vp/domain';
import { and, eq, sql } from 'drizzle-orm';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { videoCaptions: vc, videoTranscriptCues: cue, videos, channels } = schema;

/** A write that bumps the version and stamps the change; callers add the columns that differ. */
export function bumped(changes: Partial<typeof vc.$inferInsert>) {
  return { ...changes, version: sql`${vc.version} + 1`, updatedAt: new Date() };
}

export async function lockTrack(
  tx: PostgresDatabase,
  id: string,
  expectedVersion: number
): Promise<CaptionRecord | null> {
  const [row] = await tx
    .select()
    .from(vc)
    .where(and(eq(vc.id, id), eq(vc.version, expectedVersion)))
    .for('update');
  return row ?? null;
}

/** One parameter for the whole transcript, so a long one never meets the bind-parameter limit. */
const toRow = ({ index, startMs, endMs, text }: TranscriptCue) => ({
  index,
  start_ms: startMs,
  end_ms: endMs,
  text,
});

export async function replaceCues(
  tx: PostgresDatabase,
  captionId: string,
  cues: TranscriptCue[]
): Promise<void> {
  await tx.delete(cue).where(eq(cue.captionId, captionId));
  if (cues.length === 0) return;
  await tx.execute(sql`
    insert into ${cue} (caption_id, cue_index, start_ms, end_ms, text)
    select ${captionId}::uuid, c.index, c.start_ms, c.end_ms, c.text
    from jsonb_to_recordset(${JSON.stringify(cues.map(toRow))}::jsonb)
      as c(index int, start_ms int, end_ms int, text text)
  `);
}

async function ownerOf(tx: PostgresDatabase, videoId: string): Promise<string | null> {
  const [row] = await tx
    .select({ ownerId: videos.ownerId })
    .from(videos)
    .where(eq(videos.id, videoId));
  return row?.ownerId ?? null;
}

type CaptionEvent = `captions.${string}`;

export async function record(
  tx: PostgresDatabase,
  type: CaptionEvent,
  track: CaptionRecord,
  announcement?: UserEvent
): Promise<void> {
  await tx.insert(schema.videoEvents).values({
    videoId: track.videoId,
    type,
    payload: { captionId: track.id, language: track.language, reason: track.reason },
  });
  if (!announcement) return;

  const userId = await ownerOf(tx, track.videoId);
  if (userId) await appendUserEvent(tx, { userId, ...announcement });
}

/** A video's own switch beside its channel's default; an owner without a channel defaults to off. */
export async function settingsOf(
  db: PostgresDatabase,
  videoId: string
): Promise<CaptionSettings | null> {
  const [row] = await db
    .select({
      videoId: videos.id,
      ownerId: videos.ownerId,
      autoCaptions: videos.autoCaptions,
      channelDefault: channels.autoCaptionsDefault,
    })
    .from(videos)
    .leftJoin(channels, eq(channels.userId, videos.ownerId))
    .where(eq(videos.id, videoId));
  return row ? { ...row, channelDefault: row.channelDefault ?? false } : null;
}
