import { ControlBar } from './components/control-bar';
import { VideoJsEngine } from './engine/video-js-engine';
import type { TaitubePlayerProps } from './taitube-player-props';
import { usePlaybackTelemetry } from './telemetry/use-playback-telemetry';

export interface TaitubePlayerWithTelemetryProps extends TaitubePlayerProps {
  videoId: string;
}

export function TaitubePlayer({ videoId, controls = true, ...props }: TaitubePlayerWithTelemetryProps) {
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
      {controls && props.layout !== 'vertical' && <ControlBar />}
    </VideoJsEngine>
  );
}
