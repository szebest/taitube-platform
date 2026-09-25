import type { ChannelRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { ChannelCard, Video } from '@vp/domain';
import { type UserContext, canReadVideo } from '@vp/permissions';
import { unwrapOr } from '@vp/result';

export interface VideoLookups {
  videosRepo: Pick<VideoRepository, 'findById'>;
  channelsRepo: Pick<ChannelRepositoryPort, 'findByUserId'>;
}

export interface WatchableVideo {
  video: Video;
  channel: ChannelCard | null;
}

/** The in-memory form of `watchableVideoScope`: readable by the viewer and not deleted. */
export async function watchableVideo(
  lookups: VideoLookups,
  viewer: UserContext | null,
  videoId: string
): Promise<WatchableVideo | null> {
  const video = unwrapOr(await lookups.videosRepo.findById(videoId), null);
  if (!video || video.deletedAt || video.status === 'DELETED') return null;
  if (!canReadVideo({ user: viewer, video })) return null;
  return { video, channel: await channelCard(lookups, video.ownerId) };
}

export async function channelCard(
  lookups: VideoLookups,
  userId: string
): Promise<ChannelCard | null> {
  const channel = unwrapOr(await lookups.channelsRepo.findByUserId(userId), null);
  if (!channel) return null;
  const { id, handle, displayName, avatarUrl } = channel;
  return { id, handle, displayName, avatarUrl };
}
