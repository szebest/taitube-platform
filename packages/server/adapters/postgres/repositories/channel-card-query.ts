import * as schema from '@vp/db';
import type { ChannelCard } from '@vp/domain';

const { channels: ch } = schema;

/** Selected over a `LEFT JOIN channels` on the row's channel. */
export const channelCardColumns = {
  channelId: ch.id,
  handle: ch.handle,
  displayName: ch.displayName,
  avatarUrl: ch.avatarUrl,
};

export interface ChannelCardRow {
  channelId: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Null when the join found nothing. */
export function toChannelCard(row: ChannelCardRow): ChannelCard | null {
  const { channelId, handle, displayName, avatarUrl } = row;
  return channelId !== null && handle !== null && displayName !== null
    ? { id: channelId, handle, displayName, avatarUrl }
    : null;
}
