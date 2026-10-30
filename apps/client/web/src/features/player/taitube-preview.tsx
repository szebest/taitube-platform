import { ControlBar } from './components/control-bar';
import { VideoJsEngine } from './engine/video-js-engine';
import type { TaitubePlayerProps } from './taitube-player-props';

/** The player without its telemetry, for a preview that must not count as a view. */
export function TaitubePreview(props: TaitubePlayerProps) {
  return (
    <VideoJsEngine {...props}>
      <ControlBar />
    </VideoJsEngine>
  );
}
