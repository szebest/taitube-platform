import { liveFeature, videoFeatures } from '@videojs/core/dom';
import { Container, createPlayer, Gesture, LiveButton, Poster, useContainer } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { fromPromise, ignore, isOk } from '@vp/result';
import {
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useEffectEvent,
  useRef,
} from 'react';
import { bufferedEndAt } from '#app/lib/player/buffered-end';
import { findDefaultRendition } from '#app/lib/player/playback-defaults';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import type { PlayerCommands, PlayerState } from '#app/lib/player/player-port';
import type {
  PlaybackControl,
  PlaybackDefaults,
  PlaybackQuality,
  PlaybackRange,
  TaitubePlayerProps,
} from '#app/lib/player/taitube-player-props';
import { CaptionsContext, useCaptions, useCaptionsContext } from './hooks/use-captions';

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

    const speed = control?.speed ?? defaults?.speed;
    if (speed !== undefined) {
      currentTarget.playbackRate = speed;
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
          data-mode="dark"
          className={
            vertical || fill
              ? 'relative size-full overflow-hidden bg-media font-sans text-on-media'
              : 'relative aspect-video w-full overflow-hidden rounded-thumb bg-media font-sans text-on-media not-data-controls-visible:cursor-none [&:fullscreen]:rounded-none'
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
        <ChannelBinding videoRef={videoRef} />
      </CaptionsContext>
    </VideoPlayer>
  );
}

/** The media starts as the element's `autoPlay` and `muted` say; only a change after that is a command. */
function PlaybackSync({ paused, muted, speed, captions }: PlaybackControl) {
  const { play, pause, setMuted, setPlaybackRate } = usePlayerCommands();
  const { state, commands } = useCaptionsContext();
  const shown = state.captionsEnabled;
  const applied = useRef({ paused, muted, speed });

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

  useEffect(() => {
    if (speed === undefined || applied.current.speed === speed) {
      return;
    }

    applied.current.speed = speed;
    setPlaybackRate(speed);
  }, [speed, setPlaybackRate]);

  useEffect(() => {
    if (captions !== undefined && captions !== shown) {
      commands.toggleCaptions();
    }
  }, [captions, shown, commands]);

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

function ChannelBinding({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const channel = useOfferedPlayerChannel();
  const { seek } = usePlayerCommands();
  const fullscreen = usePlayerState((state) => state.fullscreen);
  const captionTrackId = usePlayerState((state) => state.activeCaptionTrack?.id ?? null);
  const canPictureInPicture = usePlayerState((state) => state.canPictureInPicture);
  const pictureInPicture = usePlayerState((state) => state.pictureInPicture);
  const { requestPictureInPicture, exitPictureInPicture } = usePlayerCommands();

  useEffect(() => channel?.attach(seek), [channel, seek]);

  useEffect(() => {
    const video = videoRef.current;
    if (!channel || !video) {
      return;
    }

    const publishTime = () => channel.publish(video.currentTime);
    publishTime();
    video.addEventListener('timeupdate', publishTime);
    video.addEventListener('seeked', publishTime);
    const stopListening = () => {
      video.removeEventListener('timeupdate', publishTime);
      video.removeEventListener('seeked', publishTime);
    };
    return stopListening;
  }, [channel, videoRef]);

  useEffect(() => {
    channel?.publishFullscreen(fullscreen);
  }, [channel, fullscreen]);

  useEffect(() => {
    channel?.publishPictureInPicture({ available: canPictureInPicture, active: pictureInPicture });
  }, [channel, canPictureInPicture, pictureInPicture]);

  useEffect(
    () =>
      channel?.attachPictureInPicture(
        pictureInPicture ? exitPictureInPicture : requestPictureInPicture
      ),
    [channel, pictureInPicture, requestPictureInPicture, exitPictureInPicture]
  );

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
      buffering: state.waiting,
      ended: state.ended,
      currentTime: state.currentTime,
      duration: state.duration,
      bufferedEnd: bufferedEndAt(state.buffered, state.currentTime),
      volume: state.volume,
      muted: state.muted,
      playbackRate: state.playbackRate,
      fullscreen: state.isFullscreen,
      canFullscreen: state.fullscreenAvailability === 'available',
      pictureInPicture: state.isPictureInPicture,
      canPictureInPicture: state.pictureInPictureAvailability === 'available',
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
    requestPictureInPicture,
    exitPictureInPicture,
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
    requestPictureInPicture: async () => {
      ignore(
        await fromPromise(
          async () => requestPictureInPicture(),
          (cause) => cause
        ),
        'a refused picture in picture leaves the video where it is'
      );
    },
    exitPictureInPicture: async () => {
      ignore(
        await fromPromise(
          async () => exitPictureInPicture(),
          (cause) => cause
        ),
        'a refused exit leaves the video in its window'
      );
    },
    requestControlsLock,
    ...commands,
  };
}

/** The element that goes fullscreen: a menu portals into it, or fullscreen hides the menu. */
export function usePlayerContainer(): HTMLElement | null {
  return useContainer();
}
