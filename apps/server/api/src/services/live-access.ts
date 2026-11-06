import type {
  ChannelRepositoryPort,
  LiveStreamRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import type { Channel, LiveStream, Video } from '@vp/domain';
import {
  decideVideoRead,
  type LiveStreamNotFound,
  liveStreamNotFound,
  type VideoReadRequiresAuth,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, isErr, ok, type Result } from '@vp/result';

export interface LiveAccessDeps {
  liveStreams: LiveStreamRepositoryPort;
  channels: ChannelRepositoryPort;
  videos: VideoRepository;
}

export interface WatchableLive {
  stream: LiveStream;
  video: Video;
  channel: Channel;
}

export type ReadLiveFailure = LiveStreamNotFound | VideoReadRequiresAuth | DatabaseUnavailable;

/**
 * Who may watch a broadcast is who may read its video, so a private stream stays its owner's. An idle
 * stream has no video and reads as absent, as does one the caller may not see: the id says nothing.
 */
export async function readLive(
  deps: LiveAccessDeps,
  viewer: UserContext | null,
  liveStreamId: string
): Promise<Result<WatchableLive, ReadLiveFailure>> {
  const notFound = err(liveStreamNotFound(liveStreamId));

  const stream = await deps.liveStreams.findById(liveStreamId);
  if (isErr(stream)) return stream;
  const videoId = stream.value?.videoId;
  if (!(stream.value && videoId)) return notFound;

  const video = await deps.videos.findById(videoId);
  if (isErr(video)) return video;
  const decided = decideVideoRead({ viewer, video: video.value, videoId });
  if (isErr(decided)) {
    const failure = decided.error;
    return failure.code === ErrorCodes.UNAUTHORIZED ? err(failure) : notFound;
  }

  const channel = await deps.channels.findById(stream.value.channelId);
  if (isErr(channel)) return channel;
  return channel.value
    ? ok({ stream: stream.value, video: decided.value, channel: channel.value })
    : notFound;
}
