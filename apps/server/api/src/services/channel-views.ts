import type { Channel as ChannelResource } from '@vp/api-contracts';
import type { Channel, ChannelStats, LiveStream } from '@vp/domain';

export type ChannelView = ChannelResource;

/** Only a public broadcast puts the live dot on the channel: anyone may read this resource. */
function liveOf(stream: LiveStream | null): ChannelView['live'] {
  if (!(stream?.status === 'LIVE' && stream.visibility === 'public')) return null;
  const { id, videoId, startedAt } = stream;
  return videoId && startedAt
    ? { liveStreamId: id, videoId, startedAt: startedAt.toISOString() }
    : null;
}

export function toChannelView(
  channel: Channel,
  stats: ChannelStats,
  stream: LiveStream | null
): ChannelView {
  return {
    ...channel,
    ...stats,
    live: liveOf(stream),
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}
