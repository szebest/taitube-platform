import { VideoJsEngine } from '#app/integrations/video-js/video-js-engine';
import type { TaitubePlayerProps } from '#app/lib/player/taitube-player-props';
import { ControlBar } from '../control-bar/control-bar';

/** The player without its telemetry, for a preview that must not count as a view. */
export function TaitubePreview(props: TaitubePlayerProps) {
  return (
    <VideoJsEngine {...props}>
      <ControlBar />
    </VideoJsEngine>
  );
}
