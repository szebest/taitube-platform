import type { ReactNode } from 'react';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import type { PlaybackAttribution } from '#app/lib/player/playback-attribution';
import type { TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { ControlBar } from '../control-bar/control-bar';
import { PlayerCardLayer } from '../player-card-layer';
import { CaptionOverlay } from './components/caption-overlay/caption-overlay';
import { PlayerHotkeys } from './components/player-hotkeys/player-hotkeys';
import { StatsOverlay } from './components/stats-overlay/stats-overlay';
import { usePlaybackTelemetry } from './hooks/use-playback-telemetry';

export interface TaitubePlayerWithTelemetryProps extends TaitubePlayerProps {
  videoId: string;
  /** The share link and the test variant of the read, for the playback beacon. */
  attribution?: PlaybackAttribution;
  /** Drawn over the picture inside the element that goes fullscreen, such as a live chat. */
  overlay?: ReactNode;
}

export function TaitubePlayer({
  videoId,
  attribution,
  controls = true,
  overlay,
  ...props
}: TaitubePlayerWithTelemetryProps) {
  const telemetry = usePlaybackTelemetry(videoId, attribution);

  return (
    <VideoJsEngine
      {...props}
      onPlay={(progress) => {
        telemetry.onPlay(progress);
        props.onPlay?.(progress);
      }}
      onPause={(progress) => {
        telemetry.onPause(progress);
        props.onPause?.(progress);
      }}
      onWaiting={() => {
        telemetry.onWaiting();
        props.onWaiting?.();
      }}
      onTimeUpdate={(progress) => {
        telemetry.onTimeUpdate(progress);
        props.onTimeUpdate?.(progress);
      }}
      onEnded={(end) => {
        telemetry.onEnded(end);
        props.onEnded?.(end);
      }}
      onQualityChange={(quality) => {
        telemetry.onQualityChange(quality);
        props.onQualityChange?.(quality);
      }}
    >
      {props.defaults?.statsOverlay && <StatsOverlay />}
      <CaptionOverlay />
      {props.cards && props.cards.length > 0 && <PlayerCardLayer cards={props.cards} />}
      {overlay}
      {controls && props.layout !== 'vertical' && (
        <>
          <ControlBar
            title={props.title ?? undefined}
            live={props.live}
            range={props.range}
            chapters={props.chapters}
            onPrevious={props.onPrevious}
            onNext={props.onNext}
          />
          <PlayerHotkeys />
        </>
      )}
    </VideoJsEngine>
  );
}
