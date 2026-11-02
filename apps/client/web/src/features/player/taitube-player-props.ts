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

export interface PlaybackRange {
  startMs: number;
  endMs: number;
}

export type PlayerLayout = 'landscape' | 'vertical' | 'fill';

/** The playback a caller owns: the engine plays or pauses and mutes to match, and reports back through the callbacks. */
export interface PlaybackControl {
  paused: boolean;
  muted: boolean;
}

export interface PlaybackDefaults {
  speed: number;
  /** `auto`, or a rung such as `720p`. */
  quality: string;
  captionsOn: boolean;
  /** `null` takes the video's first captions. */
  captionsLanguage: string | null;
  statsOverlay: boolean;
}

export interface TaitubePlayerProps extends Pick<Video, 'posterUrl' | 'title'> {
  playbackUrl: string;
  /**
   * `vertical` fills its parent, crops to cover and draws no controls: a 9:16 frame brings its own.
   * `fill` fills its parent and letterboxes, for a frame the embedder sizes.
   */
  layout?: PlayerLayout;
  /** Draws the control bar; `false` leaves the picture and the tap to pause. */
  controls?: boolean;
  loop?: boolean;
  control?: PlaybackControl;
  startTime?: number;
  /** Starts at `startMs` and goes back there on reaching `endMs`; it wins over `startTime`. */
  range?: PlaybackRange;
  /** Where a video starts: the speed, quality, captions and stats overlay the viewer chose to begin every video with. */
  defaults?: PlaybackDefaults;
  onPlay?: (progress: PlaybackProgress) => void;
  onPause?: (progress: PlaybackProgress) => void;
  onWaiting?: () => void;
  onTimeUpdate?: (progress: PlaybackProgress) => void;
  onEnded?: (end: PlaybackEnd) => void;
  onQualityChange?: (quality: PlaybackQuality) => void;
}
