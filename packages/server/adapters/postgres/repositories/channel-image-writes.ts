import type { ChannelImageCommit } from '@vp/core/repositories';
import { channelImageUploads as up, channels } from '@vp/db';
import { channelImageFailed, channelImageReady, type ChannelImageUpload } from '@vp/domain';
import { and, eq, lt, sql } from 'drizzle-orm';
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

  const current = (upload.kind === 'avatar' ? channel?.avatar : channel?.banner) ?? 0;
  return Math.max(current, queued?.newest ?? 0) + 1;
}

/**
 * Moves the channel's version to the upload's when it is newer, and only then: the compare is in
 * the write, so a retried or late job cannot take an older image back.
 */
export async function commitUpload(
  tx: PostgresDatabase,
  upload: ImageUploadRow,
  defaultUrl: string
): Promise<ChannelImageCommit> {
  const version = upload.version ?? 0;
  const advanced =
    upload.kind === 'avatar'
      ? await tx
          .update(channels)
          .set({ avatarVersion: version, avatarUrl: defaultUrl, updatedAt: new Date() })
          .where(and(eq(channels.id, upload.channelId), lt(channels.avatarVersion, version)))
          .returning({ id: channels.id })
      : await tx
          .update(channels)
          .set({
            bannerVersion: version,
            bannerUrl: defaultUrl,
            bannerCrops: upload.crops?.kind === 'banner' ? upload.crops.crops : undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(channels.id, upload.channelId), lt(channels.bannerVersion, version)))
          .returning({ id: channels.id });
  const applied = advanced.length > 0;

  const [row] = await tx
    .update(up)
    .set({ status: applied ? 'ready' : 'superseded', updatedAt: new Date() })
    .where(eq(up.id, upload.id))
    .returning();
  if (!row) throw new Error('channel_image_uploads update returned no row');

  if (applied) {
    await appendChannelAudit(tx, {
      channelId: upload.channelId,
      actorUserId: upload.uploadedBy,
      action: 'channel.updated',
      targetType: 'channel',
      targetId: upload.channelId,
      meta: { fields: [upload.kind] },
    });
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
    .where(eq(up.id, upload.id))
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
