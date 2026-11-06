import { liveFeature, videoFeatures } from '@videojs/core/dom';
import { Container, createPlayer, Gesture, LiveButton, Poster, useContainer } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { fromPromise, isOk } from '@vp/result';
import { type ReactNode, type SyntheticEvent, useEffect, useEffectEvent, useRef } from 'react';
import { findDefaultRendition } from '../playback-defaults';
import { useOfferedPlayerChannel } from '../player-channel';
import type { PlayerCommands, PlayerState } from '../player-port';
import type {
  PlaybackControl,
  PlaybackDefaults,
  PlaybackQuality,
  PlaybackRange,
  TaitubePlayerProps,
} from '../taitube-player-props';
import { CaptionsContext, useCaptions, useCaptionsContext } from './use-captions';

export const AUTO_QUALITY = 'auto';

const { Player: VideoPlayer, usePlayer } = createPlayer({
  features: [...videoFeatures, liveFeature],
  displayName: 'TaitubeVideoPlayer',
});

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
  loop,
  control,
  defaults,
  captionTracks,
  onPlay,
  onPause,
  onWaiting,
  onTimeUpdate,
  onEnded,
  onQualityChange,
  children,
}: VideoJsEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const channel = useOfferedPlayerChannel();
  const captions = useCaptions(videoRef, playbackUrl, captionTracks, defaults);

  const startAt = range ? range.startMs / MS_PER_SECOND : startTime;

  const handleLoadedMetadata = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (startAt) {
      currentTarget.currentTime = startAt;
    }

    if (defaults) {
      currentTarget.playbackRate = defaults.speed;
    }

    if (control && !control.paused) {
      startPlaying(currentTarget);
    }
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
    channel?.end();
  };

  /** A browser that refuses autoplay fires no `pause`, so the refusal is what tells the caller it is not playing. */
  const startPlaying = async (video: HTMLVideoElement) => {
    const started = await fromPromise(
      async () => video.play(),
      (cause) => cause
    );
    if (isOk(started)) {
      return;
    }

    onPause?.({ currentTime: video.currentTime, duration: video.duration });
  };

  const vertical = layout === 'vertical';
  const fill = layout === 'fill';

  return (
    <VideoPlayer title={title} poster={posterUrl}>
      <CaptionsContext value={captions}>
        <Container
          data-theme="dark"
          className={
            vertical || fill
              ? 'relative size-full overflow-hidden bg-bg font-sans text-fg'
              : 'relative aspect-video w-full overflow-hidden rounded-thumb bg-bg font-sans text-fg not-data-controls-visible:cursor-none [&:fullscreen]:rounded-none'
          }
        >
          <HlsJsVideo
            ref={videoRef}
            src={playbackUrl}
            crossOrigin="anonymous"
            playsInline
            loop={loop}
            muted={control?.muted}
            autoPlay={control && !control.paused}
            className={vertical ? 'size-full object-cover' : 'size-full object-contain'}
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
          >
            {captions.state.captionTracks.map(({ id, language, src }) => (
              <track key={id} id={id} kind="captions" src={src} srcLang={language ?? undefined} />
            ))}
          </HlsJsVideo>
          <Poster.Root className="pointer-events-none absolute inset-0 not-data-visible:hidden">
            <Poster.Image className="size-full object-cover" />
          </Poster.Root>
          {!vertical && <Gesture type="tap" action="togglePaused" pointer="mouse" />}
          {children}
        </Container>
        {control && <PlaybackSync {...control} />}
        {defaults && <StartAtDefaultQuality key={playbackUrl} quality={defaults.quality} />}
        <QualityReport onQualityChange={onQualityChange} />
        <ChannelBinding />
      </CaptionsContext>
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

function StartAtDefaultQuality({ quality }: Pick<PlaybackDefaults, 'quality'>) {
  const { selectVideoRendition } = usePlayerCommands();
  const renditions = usePlayerState((state) => state.renditions);
  const listed = renditions.length > 0;

  const applyQuality = useEffectEvent(() => {
    const id = findDefaultRendition(renditions, quality);
    if (id !== undefined) {
      selectVideoRendition(id);
    }
  });

  useEffect(() => {
    if (listed) {
      applyQuality();
    }
  }, [listed]);

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
  const fullscreen = usePlayerState((state) => state.fullscreen);
  const captionTrackId = usePlayerState((state) => state.activeCaptionTrack?.id ?? null);

  useEffect(() => channel?.attach(seek), [channel, seek]);

  useEffect(() => {
    channel?.publish(currentTime);
  }, [channel, currentTime]);

  useEffect(() => {
    channel?.publishFullscreen(fullscreen);
  }, [channel, fullscreen]);

  useEffect(() => {
    channel?.publishCaptionTrack(captionTrackId);
  }, [channel, captionTrackId]);

  return null;
}

export interface LiveEdgeButtonProps {
  /** The button's name: at the edge it says the stream is live, behind it that it goes back there. */
  label: (atLiveEdge: boolean) => string;
  children: (atLiveEdge: boolean) => ReactNode;
}

/** Shows whether a live stream plays at its live edge, and seeks back there when pressed. */
export function LiveEdgeButton({ label, children }: LiveEdgeButtonProps) {
  return (
    <LiveButton
      label={({ liveEdge }) => label(liveEdge)}
      className="inline-flex h-control-md items-center rounded-control border-0 bg-transparent px-inline focus-ring"
      render={(props, { liveEdge }) => (
        <button type="button" {...props}>
          {children(liveEdge)}
        </button>
      )}
    />
  );
}

/** Reads the playback state a skin draws; it re-renders only when the selected value changes. */
export function usePlayerState<Selected>(select: (state: PlayerState) => Selected): Selected {
  const { state: captions } = useCaptionsContext();

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
      ...captions,
    })
  );
}

export function usePlayerCommands(): PlayerCommands {
  const {
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    setPlaybackRate,
    selectVideoRendition,
    requestFullscreen,
    exitFullscreen,
    requestControlsLock,
  } = usePlayer();
  const { commands } = useCaptionsContext();

  return {
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    setPlaybackRate,
    selectVideoRendition,
    requestFullscreen,
    exitFullscreen,
    requestControlsLock,
    ...commands,
  };
}

/** The element that goes fullscreen: a menu portals into it, or fullscreen hides the menu. */
export function usePlayerContainer(): HTMLElement | null {
  return useContainer();
}
