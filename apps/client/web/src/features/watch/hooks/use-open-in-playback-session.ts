import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { useEffect } from 'react';
import { usePlaybackSession } from '#app/hooks/use-playback-queue';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { type OpenInPlaybackSession, toOpenAction } from '../utils/to-open-action';

/** Hands the watch page's video, and the playlist it was opened from, to the session that plays it. */
export function useOpenInPlaybackSession({
  video,
  list,
  startTime,
  autoplay,
  shareToken,
}: OpenInPlaybackSession) {
  const api = useApi();
  const { dispatch } = usePlaybackSession();
  const { data: playlist } = useQuery({
    ...playlistQueryOptions(api, list ?? ''),
    enabled: list !== undefined,
  });

  useEffect(() => {
    dispatch(toOpenAction({ video, list, startTime, autoplay, shareToken }, playlist));
  }, [dispatch, video, list, playlist, startTime, autoplay, shareToken]);
}
