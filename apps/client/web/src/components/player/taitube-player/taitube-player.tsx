import type { ReactNode } from 'react';
import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import type { TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { ControlBar } from '../control-bar/control-bar';
import { CaptionOverlay } from './components/caption-overlay/caption-overlay';
import { PlayerHotkeys } from './components/player-hotkeys/player-hotkeys';
import { StatsOverlay } from './components/stats-overlay/stats-overlay';
import { usePlaybackTelemetry } from './hooks/use-playback-telemetry';

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
          <ControlBar live={props.live} onPrevious={props.onPrevious} onNext={props.onNext} />
          <PlayerHotkeys />
        </>
      )}
    </VideoJsEngine>
  );
}
