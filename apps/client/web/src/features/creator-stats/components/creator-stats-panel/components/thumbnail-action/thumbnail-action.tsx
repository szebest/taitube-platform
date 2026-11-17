import type { Video } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useFailureToast } from '@vp/queries';
import { Button, Icon, Popover, useToast } from '@vp/ui';
import { useUpdateVideo } from '#app/features/creator-stats/hooks/use-update-video';

/** The thumbnail choices the studio's editor offers, over the same request: today the generated frame. */
export function ThumbnailAction({ video }: { video: Video }) {
  const { tOr } = useT();
  const showToast = useToast();
  const showFailure = useFailureToast();
  const update = useUpdateVideo(video);
  const { posterUrl, thumbnailUrl } = video;
  const inUse = posterUrl !== undefined && posterUrl === thumbnailUrl;

  const usePoster = () =>
    update.mutate(
      { selectedThumbnail: { source: 'poster' } },
      {
        onSuccess: () =>
          showToast({ tone: 'success', title: tOr('creatorStats.thumbnailSaved', {}, '') }),
        onError: (error) => showFailure(tOr('creatorStats.saveFailed', {}, ''), error),
      }
    );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="soft" size="sm">
          <Icon name="video" />
          {tOr('creatorStats.thumbnail', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="flex flex-col gap-inline">
        {thumbnailUrl && (
          <figure className="m-0 flex flex-col gap-1">
            <img src={thumbnailUrl} alt="" className="w-60 rounded-thumb" />
            <figcaption className="text-label text-fg-muted">
              {tOr('creatorStats.thumbnailCurrent', {}, '')}
            </figcaption>
          </figure>
        )}
        {posterUrl && !inUse && (
          <figure className="m-0 flex flex-col gap-1">
            <img src={posterUrl} alt="" className="w-60 rounded-thumb" />
            <figcaption className="text-label text-fg-muted">
              {tOr('creatorStats.thumbnailPoster', {}, '')}
            </figcaption>
            <Button size="sm" loading={update.isPending} onClick={usePoster}>
              {tOr('creatorStats.thumbnailUse', {}, '')}
            </Button>
          </figure>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}
