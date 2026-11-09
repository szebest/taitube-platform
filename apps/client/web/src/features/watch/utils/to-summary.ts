import type { Video, VideoSummary } from '@vp/api-contracts';

export function toSummary(video: Video): VideoSummary {
  return { ...video, channel: video.channel ?? null };
}
