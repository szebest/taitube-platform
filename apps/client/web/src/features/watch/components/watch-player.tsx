import { useProgressWriter } from '#app/features/library/hooks/use-progress-writer';
import { TaitubePlayer, type TaitubePlayerWithTelemetryProps } from '#app/features/player';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';

/** The player on the watch page: it starts at the viewer's chosen speed and quality and saves where they get to. */
export function WatchPlayer(props: TaitubePlayerWithTelemetryProps) {
  const [speed] = usePlaybackPreference('speed');
  const [quality] = usePlaybackPreference('quality');
  const progressWriter = useProgressWriter(props.videoId);

  return <TaitubePlayer defaults={{ speed, quality }} {...progressWriter} {...props} />;
}
