import { useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { useEffect } from 'react';

import { playlistQueryOptions } from '#app/features/library/api/library-queries';

import { toSummary } from '../to-summary';
import { usePlaybackSession } from './use-playback-queue';

export interface OpenInPlaybackSession {
  video: Video;
  list: string | undefined;
  startTime: number | undefined;
  autoplay: boolean;
}

/** Hands the watch page's video, and the playlist it was opened from, to the session that plays it. */
export function useOpenInPlaybackSession({
  video,
  list,
  startTime,
  autoplay,
}: OpenInPlaybackSession) {
  const api = useApi();
  const { dispatch } = usePlaybackSession();
  const { data: playlist } = useQuery({
    ...playlistQueryOptions(api, list ?? ''),
    enabled: list !== undefined,
  });

  useEffect(() => {
    dispatch({
      type: 'open',
      video: toSummary(video),
      list,
      playlist: playlist && {
        id: playlist.id,
        videos: playlist.items.map((item) => item.video),
      },
      startTime,
      autoplay,
    });
  }, [dispatch, video, list, playlist, startTime, autoplay]);
}
