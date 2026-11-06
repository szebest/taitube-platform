import { useQuery } from '@tanstack/react-query';
import { captionsQueryOptions, useApi } from '@vp/queries';
import { pickCaptionTrack, useBrowserLanguages, usePlayerCaptionTrack } from '#app/features/player';
import { usePlaybackPreference } from '#app/features/settings/device/device-preferences-provider';
import { LazyTranscriptPanel } from './transcript-panel.lazy';

export interface WatchTranscriptProps {
  videoId: string;
}

/**
 * The transcript of a video with a ready caption track, in the language of the track the player
 * shows, else the one it would start with.
 */
export function WatchTranscript({ videoId }: WatchTranscriptProps) {
  const [captionsLanguage] = usePlaybackPreference('captionsLanguage');

  const api = useApi();
  const { data } = useQuery(captionsQueryOptions(api, videoId));
  const shownTrackId = usePlayerCaptionTrack();
  const browserLanguages = useBrowserLanguages();

  const ready = data?.tracks.filter(({ status }) => status === 'ready') ?? [];
  const track =
    ready.find(({ id }) => id === shownTrackId) ??
    pickCaptionTrack(ready, captionsLanguage, browserLanguages);

  if (!track) {
    return null;
  }

  return <LazyTranscriptPanel key={videoId} videoId={videoId} language={track.language} />;
}
