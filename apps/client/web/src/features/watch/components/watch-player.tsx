import { useProgressWriter } from '#app/features/library/hooks/use-progress-writer';
import type { TaitubePlayerWithTelemetryProps } from '#app/features/player';
import { LazyTaitubePlayer } from '#app/features/player/taitube-player.lazy';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';

/** The player on the watch page: it starts with the viewer's chosen playback defaults and saves where they get to. */
export function WatchPlayer({ onPause, ...props }: TaitubePlayerWithTelemetryProps) {
  const [speed] = usePlaybackPreference('speed');
  const [quality] = usePlaybackPreference('quality');
  const [captionsOn] = usePlaybackPreference('captionsOn');
  const [captionsLanguage] = usePlaybackPreference('captionsLanguage');
  const [statsOverlay] = usePlaybackPreference('statsOverlay');
  const progressWriter = useProgressWriter(props.videoId);

  return (
    <LazyTaitubePlayer
      defaults={{ speed, quality, captionsOn, captionsLanguage, statsOverlay }}
      {...progressWriter}
      {...props}
      onPause={(progress) => {
        progressWriter.onPause(progress);
        onPause?.(progress);
      }}
    />
  );
}
