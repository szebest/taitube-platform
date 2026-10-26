import type { Video } from '@vp/api-contracts';

export interface PlaybackProgress {
  currentTime: number;
  duration: number;
}

export interface PlaybackEnd {
  duration: number;
}

export interface PlaybackQuality {
  width?: number;
  height?: number;
  bitrate?: number;
  /** Whether adaptive bitrate picked this rendition, rather than the viewer. */
  auto: boolean;
}

export interface TaitubePlayerProps extends Pick<Video, 'posterUrl' | 'title'> {
  playbackUrl: string;
  startTime?: number;
  onPlay?: (progress: PlaybackProgress) => void;
  onPause?: (progress: PlaybackProgress) => void;
  onWaiting?: () => void;
  onTimeUpdate?: (progress: PlaybackProgress) => void;
  onEnded?: (end: PlaybackEnd) => void;
  onQualityChange?: (quality: PlaybackQuality) => void;
}
