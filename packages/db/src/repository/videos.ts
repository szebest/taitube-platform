import { ErrorCodes, PermanentError } from '@vp/errors';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  type NewVideo,
  type Rendition,
  type Upload,
  type Video,
  renditions,
  uploads,
  videoEvents,
  videos,
} from '../schema';
import { canTransition } from '../state-machine';

export type VideoStatus = Video['status'];

export interface TransitionVideoOptions {
  videoId: string;
  from: VideoStatus;
  to: VideoStatus;
  patch?: Partial<
    Omit<NewVideo, 'id' | 'ownerId' | 'status' | 'createdAt' | 'updatedAt' | 'version'>
  >;
  eventType?: string;
  eventPayload?: Record<string, unknown>;
  traceId?: string;
}

export interface UpdateVideoMetadataOptions {
  videoId: string;
  version: number;
  patch: {
    title?: string;
    description?: string;
    visibility?: 'private' | 'unlisted' | 'public';
  };
}

export interface VideoWithDetails {
  video: Video;
  renditions: Rendition[];
  upload?: Upload | null;
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Executes a Compare-And-Set (CAS) state transition on a video row.
 * Guarantees:
 * 1. Atomically asserts that `status == from` and sets `status = to`.
 * 2. Writes a corresponding `video_events` row in the SAME database transaction.
 * 3. Returns true if this caller won the CAS; false if another caller moved the status first.
 */
export async function transitionVideo(
  db: Database,
  options: TransitionVideoOptions
): Promise<boolean> {
  const { videoId, from, to, patch = {}, eventType, eventPayload = {}, traceId } = options;

  if (!canTransition(from, to)) {
    throw new PermanentError(
      ErrorCodes.VALIDATION_FAILED,
      `Illegal video status transition from ${from} to ${to}`
    );
  }

  const effectiveEventType = eventType || `video.${to.toLowerCase()}`;

  return await db.transaction(async (tx: Transaction) => {
    // CAS update: UPDATE videos SET status = $to, updated_at = now(), ...patch WHERE id = $id AND status = $from
    const updatedRows = await tx
      .update(videos)
      .set({
        ...patch,
        status: to,
        updatedAt: new Date(),
      })
      .where(and(eq(videos.id, videoId), eq(videos.status, from)))
      .returning({ id: videos.id });

    if (updatedRows.length === 0) {
      // 0 rows affected => another concurrent worker/process already transitioned this video
      return false;
    }

    // Append-only event in the same transaction
    await tx.insert(videoEvents).values({
      videoId,
      type: effectiveEventType,
      payload: eventPayload,
      traceId: traceId || null,
      createdAt: new Date(),
    });

    return true;
  });
}

/**
 * Optimistically updates video metadata using the version column (SDD §5.3, §6.1).
 * If version does not match, 0 rows are updated and a VERSION_CONFLICT PermanentError is thrown.
 */
export async function updateVideoMetadata(
  db: Database,
  options: UpdateVideoMetadataOptions
): Promise<Video> {
  const { videoId, version, patch } = options;

  const setPayload: Record<string, unknown> = {
    version: sql`${videos.version} + 1`,
    updatedAt: new Date(),
  };

  if (patch.title !== undefined) setPayload['title'] = patch.title;
  if (patch.description !== undefined) setPayload['description'] = patch.description;
  if (patch.visibility !== undefined) setPayload['visibility'] = patch.visibility;

  const updatedRows = await db
    .update(videos)
    .set(setPayload)
    .where(and(eq(videos.id, videoId), eq(videos.version, version)))
    .returning();

  const updated = updatedRows[0];
  if (!updated) {
    throw new PermanentError(
      ErrorCodes.VERSION_CONFLICT,
      `Version conflict on video ${videoId}: expected version ${version}`
    );
  }

  return updated;
}

export async function getVideoById(db: Database, videoId: string): Promise<Video | null> {
  const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  return rows[0] || null;
}

export async function getVideoWithDetails(
  db: Database,
  videoId: string
): Promise<VideoWithDetails | null> {
  const video = await getVideoById(db, videoId);
  if (!video) return null;

  const videoRenditions = await db.select().from(renditions).where(eq(renditions.videoId, videoId));

  const uploadRows = await db.select().from(uploads).where(eq(uploads.videoId, videoId)).limit(1);

  return {
    video,
    renditions: videoRenditions,
    upload: uploadRows[0] || null,
  };
}
