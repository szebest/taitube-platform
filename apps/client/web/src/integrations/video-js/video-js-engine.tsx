import { fromPromise, ignoreRejection, isOk } from '@kit/result';
import { Container, Gesture, Poster } from '@videojs/react';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { type ReactNode, type SyntheticEvent, useRef } from 'react';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import type { TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { ChannelBinding } from './components/channel-binding';
import { PlaybackSync } from './components/playback-sync';
import { QualityReport } from './components/quality-report';
import { StartAtDefaultQuality } from './components/start-at-default-quality';
import { CaptionsContext, useCaptions } from './hooks/use-captions';
import { useRangePlayback } from './hooks/use-range-playback';
import { VideoPlayer } from './player';

export { LiveEdgeButton } from './components/live-edge-button';
export { AUTO_QUALITY, usePlayerState } from './hooks/use-player-state';
export { usePlayerCommands } from './hooks/use-player-commands';
export { usePlayerContainer } from './hooks/use-player-container';

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

  const rangePlayback = useRangePlayback({ range, loop, startTime, onEnded });

  const handleLoadedMetadata = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    rangePlayback.onLoadedMetadata(currentTarget);

    const speed = control?.speed ?? defaults?.speed;
    if (speed !== undefined) {
      currentTarget.playbackRate = speed;
    }

    if (control && !control.paused) {
      ignoreRejection(
        startPlaying(currentTarget),
        'startPlaying reports a refused play through onPause itself'
      );
    }
  };

  const handleTimeUpdate = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    const { currentTime, duration } = currentTarget;
    rangePlayback.onTimeUpdate(currentTarget);
    onTimeUpdate?.({ currentTime, duration });
  };

  const handleEnded = ({ currentTarget }: SyntheticEvent<HTMLVideoElement>) => {
    if (rangePlayback.onVideoEnded(currentTarget)) {
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
            onPlaying={({ currentTarget }) => {
              rangePlayback.onPlaying(currentTarget);
              onPlay?.({
                currentTime: currentTarget.currentTime,
                duration: currentTarget.duration,
              });
            }}
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
