import type { CaptionTrackView, Video } from '@vp/api-contracts';
import type { PlaybackPreferences } from '@vp/domain/settings';

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

type PlayerLayout = 'landscape' | 'vertical' | 'fill';

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
  captionsSize: PlaybackPreferences['captionsSize'];
  captionsBackground: PlaybackPreferences['captionsBackground'];
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
  /** A live stream: the control bar shows the live badge in place of the seek bar and the clock. */
  live?: boolean;
  loop?: boolean;
  /** Draws the skip buttons the queue answers; one left out is not drawn. */
  onPrevious?: () => void;
  onNext?: () => void;
  control?: PlaybackControl;
  startTime?: number;
  /** Starts at `startMs` and goes back there on reaching `endMs`; it wins over `startTime`. */
  range?: PlaybackRange;
  /** Where a video starts: the speed, quality, captions and stats overlay the viewer chose to begin every video with. */
  defaults?: PlaybackDefaults;
  /** The video's caption tracks; the ready ones are side-loaded and offered in the captions menu. */
  captionTracks?: readonly CaptionTrackView[];
  onPlay?: (progress: PlaybackProgress) => void;
  onPause?: (progress: PlaybackProgress) => void;
  onWaiting?: () => void;
  onTimeUpdate?: (progress: PlaybackProgress) => void;
  onEnded?: (end: PlaybackEnd) => void;
  onQualityChange?: (quality: PlaybackQuality) => void;
}
