import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { usePostComposer } from '#app/components/posts/post-composer';
import { shareablePlaylistsQueryOptions } from '#app/features/posts/api/post-queries';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { ShareTargetPicker } from '../share-target-picker/share-target-picker';

/** The viewer's public playlists, the only ones a post can share. */
export function PlaylistPicker() {
  const { tOr } = useT();
  const { channelId } = useActiveChannel();
  const { draft, change } = usePostComposer('Playlist');
  const playlists = useQuery(shareablePlaylistsQueryOptions(useApi(), channelId));
  const options = (playlists.data ?? []).map(({ id, title }) => ({
    id,
    title,
    durationMs: null,
  }));

  return (
    <ShareTargetPicker
      label={tOr('studio.composerPlaylistLabel', {}, '')}
      value={draft.playlist}
      options={options}
      onChange={(playlist) => change({ playlist })}
    />
  );
}
