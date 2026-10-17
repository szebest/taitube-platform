import { ControlBar } from './components/control-bar';
import { VideoJsEngine } from './engine/video-js-engine';
import type { TaitubePlayerProps } from './taitube-player-props';

export function TaitubePlayer(props: TaitubePlayerProps) {
  return (
    <VideoJsEngine {...props}>
      <ControlBar />
    </VideoJsEngine>
  );
}
