import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import {
  historyItem,
  libraryVideo,
  ownedPlaylist,
  WATCH_LATER_ID,
  watchLaterPlaylist,
} from '../../__tests__/library-fixtures';
import {
  historyShelfQueryOptions,
  myPlaylistsQueryOptions,
  uploadsShelfQueryOptions,
  watchLaterShelfQueryOptions,
} from '../../api/library-queries';

export const WATCH_LATER = ownedPlaylist(0, {
  id: WATCH_LATER_ID,
  title: 'Watch later',
  isSystem: true,
});

/** A query client holding what the You hub's loader fetched. */
export function youCache({ channelId = '' } = {}) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(historyShelfQueryOptions(api).queryKey, {
    items: [historyItem(1, { title: 'Tram ride' })],
    nextCursor: null,
  });
  queryClient.setQueryData(myPlaylistsQueryOptions(api).queryKey, {
    items: [WATCH_LATER, ownedPlaylist(1, { title: 'Road trips', videoCount: 24 })],
  });
  queryClient.setQueryData(
    watchLaterShelfQueryOptions(api, WATCH_LATER_ID).queryKey,
    watchLaterPlaylist(WATCH_LATER_ID, [libraryVideo(7, 'Saved for later')])
  );
  queryClient.setQueryData(uploadsShelfQueryOptions(api, channelId).queryKey, {
    items: [libraryVideo(8, 'My upload')],
    nextCursor: null,
    total: 1,
  });
  return queryClient;
}
