import type { CaptionKind } from '@vp/domain';
import type { PlaybackPreferences } from '@vp/domain/settings';

interface PlayerRendition {
  id: string;
  height?: number;
}

/** A ready WebVTT track the engine side-loads; `language` is `null` until speech-to-text detects it. */
export interface PlayerCaptionTrack {
  id: string;
  language: string | null;
  kind: CaptionKind;
  src: string;
}

export interface PlayerCaptionStyle {
  size: PlaybackPreferences['captionsSize'];
  background: PlaybackPreferences['captionsBackground'];
}

/** What a skin reads from the engine, whichever engine plays the video. */
export interface PlayerState {
  paused: boolean;
  /** Waiting for data it does not have yet: a stall, or the first segment after a seek. */
  buffering: boolean;
  /** The media played to its end. */
  ended: boolean;
  currentTime: number;
  duration: number;
  /** Where the buffered range around the playhead ends, in seconds. */
  bufferedEnd: number;
  /** The gain the media element applies, from 0 to 1. */
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  canFullscreen: boolean;
  /** The picture is in the browser's own floating window. */
  pictureInPicture: boolean;
  /** The browser has the API and the video has pictures to float; false everywhere else, so no control is drawn. */
  canPictureInPicture: boolean;
  controlsVisible: boolean;
  renditions: readonly PlayerRendition[];
  /** The id of the rendition the viewer picked, or the engine's `AUTO_QUALITY` while adaptive bitrate picks. */
  quality: string;
  /** The height of the rendition playing now, whoever picked it. */
  activeHeight?: number;
  captionTracks: readonly PlayerCaptionTrack[];
  activeCaptionTrack: PlayerCaptionTrack | null;
  captionsEnabled: boolean;
  /** The text of the cues of the active track at the playhead, one line each. */
  captionCues: string;
  captionStyle: PlayerCaptionStyle;
}

/** What a skin asks the engine to do; a skin fires a command and draws the state it leads to. */
export interface PlayerCommands {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  selectVideoRendition(id: string): void;
  requestFullscreen(): void;
  exitFullscreen(): void;
  requestPictureInPicture(): void;
  exitPictureInPicture(): void;
  /** Keeps the controls shown, idle or not, until the returned release runs. */
  requestControlsLock(): () => void;
  /** `null` turns captions off. */
  selectCaptionTrack(id: string | null): void;
  /** Turns captions off, or back on with the track shown last, else the one a video starts with. */
  toggleCaptions(): void;
  setCaptionStyle(style: Partial<PlayerCaptionStyle>): void;
}
