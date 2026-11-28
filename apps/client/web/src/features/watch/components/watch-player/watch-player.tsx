import { useQuery } from '@tanstack/react-query';
import {
  captionsQueryOptions,
  correctionsQueryOptions,
  useApi,
  videoQueryOptions,
} from '@vp/queries';
import type { TaitubePlayerWithTelemetryProps } from '#app/components/player/taitube-player';
import { LazyTaitubePlayer } from '#app/components/player/taitube-player/taitube-player.lazy';
import { useProgressWriter } from '#app/hooks/use-progress-writer';
import { playbackAttribution } from '#app/lib/player/playback-attribution';
import { usePlaybackPreference } from '#app/lib/preferences/device-preferences-provider';
import { useShareToken } from '#app/lib/video-access/share-token.context';
import { LazyWatchThreadMarkers } from '../watch-thread-markers/watch-thread-markers.lazy';

/** The player on the watch page: it starts with the viewer's chosen playback defaults, offers the video's captions, corrections, chapters and thread markers, saves where it gets to and tells the beacon the read's share link and test variant. */
export function WatchPlayer({ onPause, ...props }: TaitubePlayerWithTelemetryProps) {
  const [speed] = usePlaybackPreference('speed');
  const [quality] = usePlaybackPreference('quality');
  const [captionsOn] = usePlaybackPreference('captionsOn');
  const [captionsLanguage] = usePlaybackPreference('captionsLanguage');
  const [captionsSize] = usePlaybackPreference('captionsSize');
  const [captionsBackground] = usePlaybackPreference('captionsBackground');
  const [statsOverlay] = usePlaybackPreference('statsOverlay');
  const api = useApi();
  const shareToken = useShareToken();
  const progressWriter = useProgressWriter(props.videoId);
  const { data: captions } = useQuery(captionsQueryOptions(api, props.videoId));
  const { data: corrections } = useQuery(correctionsQueryOptions(api, props.videoId, shareToken));
  const { data: video } = useQuery(videoQueryOptions(api, props.videoId, shareToken));

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
      cards={corrections?.items}
      chapters={video?.chapters}
      attribution={video && playbackAttribution(video)}
      watchTogether
      markers={props.range ? undefined : <LazyWatchThreadMarkers videoId={props.videoId} />}
      {...progressWriter}
      {...props}
      onPause={(progress) => {
        progressWriter.onPause(progress);
        onPause?.(progress);
      }}
    />
  );
}
