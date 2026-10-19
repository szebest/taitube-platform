interface PlayerRendition {
  id: string;
  height?: number;
}

/** What a skin reads from the engine, whichever engine plays the video. */
export interface PlayerState {
  paused: boolean;
  currentTime: number;
  duration: number;
  /** The gain the media element applies, from 0 to 1. */
  volume: number;
  muted: boolean;
  playbackRate: number;
  fullscreen: boolean;
  canFullscreen: boolean;
  controlsVisible: boolean;
  renditions: readonly PlayerRendition[];
  /** The id of the rendition the viewer picked, or the engine's `AUTO_QUALITY` while adaptive bitrate picks. */
  quality: string;
  /** The height of the rendition playing now, whoever picked it. */
  activeHeight?: number;
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
  /** Keeps the controls shown, idle or not, until the returned release runs. */
  requestControlsLock(): () => void;
}
