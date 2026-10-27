import { Container, Gesture, Poster, useContainer } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { usePlayer, VideoPlayer } from '@videojs/react/video';
import { type ReactNode, type SyntheticEvent, useEffect, useEffectEvent } from 'react';

import type { PlayerCommands, PlayerState } from '../player-port';
import type { PlaybackQuality, TaitubePlayerProps } from '../taitube-player-props';

export const AUTO_QUALITY = 'auto';

export interface VideoJsEngineProps extends TaitubePlayerProps {
  /** The skin, drawn over the video inside the element that goes fullscreen. */
  children?: ReactNode;
}

export function VideoJsEngine({
  playbackUrl,
  posterUrl,
  title,
  startTime,
  onPlay,
  onPause,
  onWaiting,
  onTimeUpdate,
  onEnded,
  onQualityChange,
  children,
}: VideoJsEngineProps) {
  const handleLoadedMetadata = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (!startTime) {
      return;
    }

    currentTarget.currentTime = startTime;
  };

  return (
    <VideoPlayer title={title} poster={posterUrl}>
      <Container
        data-theme="dark"
        className="tw:relative tw:aspect-video tw:w-full tw:overflow-hidden tw:rounded-thumb tw:bg-bg tw:font-sans tw:text-fg tw:not-data-controls-visible:cursor-none tw:[&:fullscreen]:rounded-none"
      >
        <HlsJsVideo
          src={playbackUrl}
          crossOrigin="anonymous"
          playsInline
          className="tw:size-full tw:object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onPlaying={({ currentTarget: { currentTime, duration } }) =>
            onPlay?.({ currentTime, duration })
          }
          onPause={({ currentTarget: { currentTime, duration } }) =>
            onPause?.({ currentTime, duration })
          }
          onWaiting={() => onWaiting?.()}
          onTimeUpdate={({ currentTarget: { currentTime, duration } }) =>
            onTimeUpdate?.({ currentTime, duration })
          }
          onEnded={({ currentTarget: { duration } }) => onEnded?.({ duration })}
        />
        <Poster.Root className="tw:pointer-events-none tw:absolute tw:inset-0 tw:not-data-visible:hidden">
          <Poster.Image className="tw:size-full tw:object-cover" />
        </Poster.Root>
        <Gesture type="tap" action="togglePaused" pointer="mouse" />
        {children}
      </Container>
      <QualityReport onQualityChange={onQualityChange} />
    </VideoPlayer>
  );
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
