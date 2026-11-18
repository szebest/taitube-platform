import type { VideoVisibility } from './status-vocabulary';
import type { ThumbnailSelection, Video } from './video';

export const ENTITY_REVISION_TYPES = ['video_metadata'] as const;
export type EntityRevisionType = (typeof ENTITY_REVISION_TYPES)[number];

export const ENTITY_REVISION_KEEP = 50;

export interface SnapshotChapter {
  startMs: number;
  title: string;
}

export interface VideoMetadataSnapshot {
  title: string | null;
  description: string | null;
  tags: string[];
  categoryId: string | null;
  visibility: VideoVisibility;
  thumbnail: ThumbnailSelection;
  chapters: SnapshotChapter[];
  commentsEnabled: boolean;
}

export interface EntitySnapshots {
  video_metadata: VideoMetadataSnapshot;
}

export interface EntityRevision<T extends EntityRevisionType = EntityRevisionType> {
  id: string;
  entityType: T;
  entityId: string;
  version: number;
  snapshot: EntitySnapshots[T];
  authorUserId: string | null;
  restoredFromVersion: number | null;
  createdAt: Date;
}

export type VideoMetadataField = keyof VideoMetadataSnapshot;

const VIDEO_METADATA_FIELDS: readonly VideoMetadataField[] = [
  'title',
  'description',
  'tags',
  'categoryId',
  'visibility',
  'thumbnail',
  'chapters',
  'commentsEnabled',
];

export function videoMetadataSnapshot(
  video: Pick<
    Video,
    'title' | 'description' | 'tags' | 'categoryId' | 'visibility' | 'commentsEnabled'
  >,
  chapters: readonly SnapshotChapter[]
): VideoMetadataSnapshot {
  return {
    title: video.title,
    description: video.description,
    tags: [...(video.tags ?? [])],
    categoryId: video.categoryId ?? null,
    visibility: video.visibility,
    thumbnail: { source: 'poster' },
    chapters: chapters.map(({ startMs, title }) => ({ startMs, title })),
    commentsEnabled: video.commentsEnabled ?? true,
  };
}

/** The fields whose value differs, in the snapshot's own order. */
export function diffSnapshots(
  from: VideoMetadataSnapshot,
  to: VideoMetadataSnapshot
): VideoMetadataField[] {
  return VIDEO_METADATA_FIELDS.filter(
    (field) => JSON.stringify(from[field]) !== JSON.stringify(to[field])
  );
}
