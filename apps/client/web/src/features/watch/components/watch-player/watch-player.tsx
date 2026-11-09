import { useQuery } from '@tanstack/react-query';
import { captionsQueryOptions, useApi } from '@vp/queries';
import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';
import { LazyTaitubePlayer } from '#app/components/player/taitube-player/taitube-player.lazy';
import { useProgressWriter } from '#app/hooks/use-progress-writer';
import { usePlaybackPreference } from '#app/lib/preferences/device-preferences-provider';

/** The player on the watch page: it starts with the viewer's chosen playback defaults, offers the video's captions and saves where it gets to. */
export function WatchPlayer({ onPause, ...props }: TaitubePlayerWithTelemetryProps) {
  const [speed] = usePlaybackPreference('speed');
  const [quality] = usePlaybackPreference('quality');
  const [captionsOn] = usePlaybackPreference('captionsOn');
  const [captionsLanguage] = usePlaybackPreference('captionsLanguage');
  const [captionsSize] = usePlaybackPreference('captionsSize');
  const [captionsBackground] = usePlaybackPreference('captionsBackground');
  const [statsOverlay] = usePlaybackPreference('statsOverlay');
  const api = useApi();
  const progressWriter = useProgressWriter(props.videoId);
  const { data: captions } = useQuery(captionsQueryOptions(api, props.videoId));

  return (
    <LazyTaitubePlayer
      defaults={{
        speed,
        quality,
        captionsOn,
        captionsLanguage,
        captionsSize,
        captionsBackground,
        statsOverlay,
      }}
      captionTracks={captions?.tracks}
      {...progressWriter}
      {...props}
      onPause={(progress) => {
        progressWriter.onPause(progress);
        onPause?.(progress);
      }}
    />
  );
}
