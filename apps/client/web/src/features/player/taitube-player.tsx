import type { ReactNode } from 'react';
import { CaptionOverlay } from './components/caption-overlay';
import { ControlBar } from './components/control-bar';
import { StatsOverlay } from './components/stats-overlay';
import { VideoJsEngine } from './engine/video-js-engine';
import { PlayerHotkeys } from './hotkeys/player-hotkeys';
import type { TaitubePlayerProps } from './taitube-player-props';
import { usePlaybackTelemetry } from './telemetry/use-playback-telemetry';

export interface TaitubePlayerWithTelemetryProps extends TaitubePlayerProps {
  videoId: string;
  /** Drawn over the picture inside the element that goes fullscreen, such as a live chat. */
  overlay?: ReactNode;
}

export function TaitubePlayer({
  videoId,
  controls = true,
  overlay,
  ...props
}: TaitubePlayerWithTelemetryProps) {
  const telemetry = usePlaybackTelemetry(videoId);

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
      {overlay}
      {controls && props.layout !== 'vertical' && (
        <>
          <ControlBar
            live={props.live}
            range={props.range}
            onPrevious={props.onPrevious}
            onNext={props.onNext}
          />
          <PlayerHotkeys />
        </>
      )}
    </VideoJsEngine>
  );
}
