import { Container, Gesture, Poster, useContainer } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { usePlayer, VideoPlayer } from '@videojs/react/video';
import { type ReactNode, type SyntheticEvent, useEffect, useEffectEvent, useRef } from 'react';

import { useOfferedPlayerChannel } from '../player-channel';
import type { PlayerCommands, PlayerState } from '../player-port';
import type {
  PlaybackControl,
  PlaybackQuality,
  PlaybackRange,
  TaitubePlayerProps,
} from '../taitube-player-props';

export const AUTO_QUALITY = 'auto';

const MS_PER_SECOND = 1000;
const SEEK_TOLERANCE_SECONDS = 0.5;

function isOutside(range: PlaybackRange, currentTime: number): boolean {
  return (
    currentTime >= range.endMs / MS_PER_SECOND ||
    currentTime < range.startMs / MS_PER_SECOND - SEEK_TOLERANCE_SECONDS
  );
}

export interface VideoJsEngineProps extends TaitubePlayerProps {
  /** The skin, drawn over the video inside the element that goes fullscreen. */
  children?: ReactNode;
}

export function VideoJsEngine({
  playbackUrl,
  posterUrl,
  title,
  startTime,
  range,
  layout = 'landscape',
  control,
  onPlay,
  onPause,
  onWaiting,
  onTimeUpdate,
  onEnded,
  onQualityChange,
  children,
}: VideoJsEngineProps) {
  const startAt = range ? range.startMs / MS_PER_SECOND : startTime;

  const handleLoadedMetadata = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (!startAt) {
      return;
    }

    currentTarget.currentTime = startAt;
  };

  const handleTimeUpdate = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    const { currentTime, duration } = currentTarget;
    if (range && isOutside(range, currentTime)) {
      currentTarget.currentTime = range.startMs / MS_PER_SECOND;
    }
    onTimeUpdate?.({ currentTime, duration });
  };

  const handleEnded = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (range) {
      currentTarget.currentTime = range.startMs / MS_PER_SECOND;
      void currentTarget.play();
      return;
    }
    onEnded?.({ duration: currentTarget.duration });
  };

  const vertical = layout === 'vertical';

  return (
    <VideoPlayer title={title} poster={posterUrl}>
      <Container
        data-theme="dark"
        className={
          vertical
            ? 'tw:relative tw:size-full tw:overflow-hidden tw:bg-bg tw:font-sans tw:text-fg'
            : 'tw:relative tw:aspect-video tw:w-full tw:overflow-hidden tw:rounded-thumb tw:bg-bg tw:font-sans tw:text-fg tw:not-data-controls-visible:cursor-none tw:[&:fullscreen]:rounded-none'
        }
      >
        <HlsJsVideo
          src={playbackUrl}
          crossOrigin="anonymous"
          playsInline
          muted={control?.muted}
          autoPlay={control && !control.paused}
          className={vertical ? 'tw:size-full tw:object-cover' : 'tw:size-full tw:object-contain'}
          onLoadedMetadata={handleLoadedMetadata}
          onPlaying={({ currentTarget: { currentTime, duration } }) =>
            onPlay?.({ currentTime, duration })
          }
          onPause={({ currentTarget: { currentTime, duration } }) =>
            onPause?.({ currentTime, duration })
          }
          onWaiting={() => onWaiting?.()}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
        <Poster.Root className="tw:pointer-events-none tw:absolute tw:inset-0 tw:not-data-visible:hidden">
          <Poster.Image className="tw:size-full tw:object-cover" />
        </Poster.Root>
        {!vertical && <Gesture type="tap" action="togglePaused" pointer="mouse" />}
        {children}
      </Container>
      {control && <PlaybackSync {...control} />}
      <QualityReport onQualityChange={onQualityChange} />
      <ChannelBinding />
    </VideoPlayer>
  );
}

/** The media starts as the element's `autoPlay` and `muted` say; only a change after that is a command. */
function PlaybackSync({ paused, muted }: PlaybackControl) {
  const { play, pause, setMuted } = usePlayerCommands();
  const applied = useRef({ paused, muted });

  useEffect(() => {
    if (applied.current.paused === paused) {
      return;
    }

    applied.current.paused = paused;
    if (paused) {
      pause();
      return;
    }

    play();
  }, [paused, play, pause]);

  useEffect(() => {
    if (applied.current.muted === muted) {
      return;
    }

    applied.current.muted = muted;
    setMuted(muted);
  }, [muted, setMuted]);

  return null;
}

function QualityReport({ onQualityChange }: Pick<TaitubePlayerProps, 'onQualityChange'>) {
  const rendition = usePlayer((state) => state.activeVideoRendition);
  const auto = usePlayer((state) => !state.videoRenditionList.some(({ selected }) => selected));

  const report = useEffectEvent((quality: PlaybackQuality) => onQualityChange?.(quality));

  useEffect(() => {
    if (!rendition) {
      return;
    }

    const { width, height, bitrate } = rendition;
    report({ width, height, bitrate, auto });
  }, [rendition, auto]);

  return null;
}

function ChannelBinding() {
  const channel = useOfferedPlayerChannel();
  const { seek } = usePlayerCommands();
  const currentTime = usePlayerState((state) => state.currentTime);

  useEffect(() => channel?.attach(seek), [channel, seek]);

  useEffect(() => {
    channel?.publish(currentTime);
  }, [channel, currentTime]);

  return null;
}

/** Reads the playback state a skin draws; it re-renders only when the selected value changes. */
export function usePlayerState<Selected>(select: (state: PlayerState) => Selected): Selected {
  return usePlayer((state) =>
    select({
      paused: state.paused,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      muted: state.muted,
      playbackRate: state.playbackRate,
      fullscreen: state.isFullscreen,
      canFullscreen: state.fullscreenAvailability === 'available',
      controlsVisible: state.controlsVisible,
      renditions: state.videoRenditionList,
      quality: state.videoRenditionList.find(({ selected }) => selected)?.id ?? AUTO_QUALITY,
      activeHeight: state.activeVideoRendition?.height,
    })
  );
}

export function usePlayerCommands(): PlayerCommands {
  return usePlayer();
}

/** The element that goes fullscreen: a menu portals into it, or fullscreen hides the menu. */
export function usePlayerContainer(): HTMLElement | null {
  return useContainer();
}
