import { assertNever } from '@kit/result';
import type { ChannelImageCommit } from '@vp/core/repositories';
import { channelImageUploads as up, channels } from '@vp/db';
import {
  CHANNEL_IMAGE_UPLOAD_EDGES as EDGES,
  channelImageFailed,
  channelImageReady,
  type ChannelImageKind,
  type ChannelImageUpload,
  type PostImageUrls,
} from '@vp/domain';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

export type ImageUploadRow = typeof up.$inferSelect;

export function toChannelImageUpload(row: ImageUploadRow): ChannelImageUpload {
  return row;
}

export async function lockUpload(tx: PostgresDatabase, id: string): Promise<ImageUploadRow | null> {
  const [row] = await tx.select().from(up).where(eq(up.id, id)).for('update');
  return row ?? null;
}

/** The version after the newest this channel's kind has, whether the channel took it or it is still in flight. */
export async function nextVersion(
  tx: PostgresDatabase,
  upload: Pick<ImageUploadRow, 'channelId' | 'kind'>
): Promise<number> {
  const [channel] = await tx
    .select({
      avatar: channels.avatarVersion,
      banner: channels.bannerVersion,
    })
    .from(channels)
    .where(eq(channels.id, upload.channelId))
    .for('update');
  const [queued] = await tx
    .select({ newest: sql<number>`coalesce(max(${up.version}), 0)`.mapWith(Number) })
    .from(up)
    .where(and(eq(up.channelId, upload.channelId), eq(up.kind, upload.kind)));

  return Math.max(heldVersion(upload.kind, channel), queued?.newest ?? 0) + 1;
}

function heldVersion(
  kind: ChannelImageKind,
  channel: { avatar: number; banner: number } | undefined
): number {
  switch (kind) {
    case 'avatar':
      return channel?.avatar ?? 0;
    case 'banner':
      return channel?.banner ?? 0;
    case 'playlist-cover':
    case 'post-image':
      return 0;
    default:
      return assertNever(kind, 'ChannelImageKind');
  }
}

async function advanceChannel(
  tx: PostgresDatabase,
  upload: ImageUploadRow,
  defaultUrl: string
): Promise<boolean> {
  const version = upload.version ?? 0;
  switch (upload.kind) {
    case 'avatar':
      return (
        (
          await tx
            .update(channels)
            .set({ avatarVersion: version, avatarUrl: defaultUrl, updatedAt: new Date() })
            .where(and(eq(channels.id, upload.channelId), lt(channels.avatarVersion, version)))
            .returning({ id: channels.id })
        ).length > 0
      );
    case 'banner':
      return (
        (
          await tx
            .update(channels)
            .set({
              bannerVersion: version,
              bannerUrl: defaultUrl,
              bannerCrops: upload.crops?.kind === 'banner' ? upload.crops.crops : undefined,
              updatedAt: new Date(),
            })
            .where(and(eq(channels.id, upload.channelId), lt(channels.bannerVersion, version)))
            .returning({ id: channels.id })
        ).length > 0
      );
    case 'playlist-cover':
    case 'post-image':
      return true;
    default:
      return assertNever(upload.kind, 'ChannelImageKind');
  }
}

/**
 * Moves the channel's version to the upload's when it is newer, and only then: the compare is in
 * the write, so a retried or late job cannot take an older image back. A playlist cover or a post image moves no
 * channel version and is always ready; the playlist takes a cover when its owner names the upload.
 */
export async function commitUpload(
  tx: PostgresDatabase,
  upload: ImageUploadRow,
  defaultUrl: string,
  variantUrls?: PostImageUrls
): Promise<ChannelImageCommit> {
  const version = upload.version ?? 0;
  const applied = await advanceChannel(tx, upload, defaultUrl);

  const [row] = await tx
    .update(up)
    .set({
      status: applied ? 'ready' : 'superseded',
      variantUrls: applied ? variantUrls : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(up.id, upload.id), inArray(up.status, [...EDGES.commit.from])))
    .returning();
  if (!row) throw new Error('channel_image_uploads update returned no row');

  if (applied) {
    if (upload.kind !== 'playlist-cover' && upload.kind !== 'post-image') {
      await appendChannelAudit(tx, {
        channelId: upload.channelId,
        actorUserId: upload.uploadedBy,
        action: 'channel.updated',
        targetType: 'channel',
        targetId: upload.channelId,
        meta: { fields: [upload.kind] },
      });
    }
    await appendUserEvent(tx, {
      userId: upload.uploadedBy,
      ...channelImageReady({
        uploadId: upload.id,
        channelId: upload.channelId,
        kind: upload.kind,
        version,
      }),
    });
  }
  return { upload: toChannelImageUpload(row), applied };
}

export async function failUpload(
  tx: PostgresDatabase,
  upload: ImageUploadRow,
  reason: string
): Promise<ChannelImageUpload> {
  const [row] = await tx
    .update(up)
    .set({ status: 'failed', failure: reason, updatedAt: new Date() })
    .where(and(eq(up.id, upload.id), inArray(up.status, [...EDGES.fail.from])))
    .returning();
  if (!row) throw new Error('channel_image_uploads update returned no row');

  await appendUserEvent(tx, {
    userId: upload.uploadedBy,
    ...channelImageFailed({
      uploadId: upload.id,
      channelId: upload.channelId,
      kind: upload.kind,
      reason,
    }),
  });
  return toChannelImageUpload(row);
}
