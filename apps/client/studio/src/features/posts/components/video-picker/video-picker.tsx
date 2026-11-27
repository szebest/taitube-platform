import { useInfiniteQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { usePostComposer } from '#app/components/posts/post-composer';
import { shareableVideosQueryOptions } from '#app/features/posts/api/post-queries';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { pagedRows } from '#app/utils/paged-rows';
import { ShareTargetPicker } from '../share-target-picker/share-target-picker';

/** The channel's public, ready videos; choosing one restarts the card at the beginning. */
export function VideoPicker() {
  const { tOr } = useT();
  const { channelId } = useActiveChannel();
  const { draft, change } = usePostComposer('Video');
  const videos = useInfiniteQuery({
    ...shareableVideosQueryOptions(useApi(), channelId),
    select: pagedRows,
  });
  const options = (videos.data ?? []).map((video) => ({
    id: video.id,
    title: video.title ?? tOr('browse.untitled', {}, ''),
    durationMs: video.durationMs ?? null,
    sprite: video.sprite,
  }));

  return (
    <ShareTargetPicker
      label={tOr('studio.composerVideoLabel', {}, '')}
      value={draft.video}
      options={options}
      onChange={(video) => change({ video, startMs: 0 })}
      hasNextPage={videos.hasNextPage}
      fetchingNextPage={videos.isFetchingNextPage}
      onLoadMore={() => void videos.fetchNextPage()}
    />
  );
}
