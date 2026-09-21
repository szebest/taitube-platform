import type { NewRenditionInput, RenditionRecord } from '@vp/core/repositories';
import type { renditions } from '@vp/db';
import { uuidv7 } from 'uuidv7';

type RenditionInsert = typeof renditions.$inferInsert;

/**
 * Domain input to an insert row. The return type is what forces every required column to be
 * supplied, so a schema change fails here rather than at runtime.
 */
export function toRenditionInsert(data: NewRenditionInput): RenditionInsert {
  return {
    id: data.id ?? uuidv7(),
    videoId: data.videoId,
    name: data.name,
    width: data.width,
    height: data.height,
    videoBitrateKbps: data.videoBitrateKbps,
    audioBitrateKbps: data.audioBitrateKbps,
    status: data.status ?? 'PENDING',
    playlistKey: data.playlistKey ?? null,
    segmentCount: data.segmentCount ?? null,
    bytes: data.bytes ?? null,
  };
}

export function toRenditionUpdate(patch: Partial<RenditionRecord>): Partial<RenditionInsert> {
  return {
    updatedAt: new Date(),
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.playlistKey !== undefined && { playlistKey: patch.playlistKey }),
    ...(patch.segmentCount !== undefined && { segmentCount: patch.segmentCount }),
    ...(patch.bytes !== undefined && { bytes: patch.bytes }),
    ...(patch.processingMs !== undefined && { processingMs: patch.processingMs }),
  };
}
