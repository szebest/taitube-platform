import { Link } from '@tanstack/react-router';
import type { ContractResult, listCreatorVideos } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { canReadAnalytics, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { unwrapOr } from '@vp/result';
import { DropdownMenu, Icon, IconButton } from '@vp/ui';

import { WEB_URL } from '#app/config';

const MS_PER_SECOND = 1000;

export type CreatorVideo = ContractResult<typeof listCreatorVideos>['items'][number];

interface LibraryVideoPartProps {
  video: CreatorVideo;
}

interface LibraryVideoTitleProps extends LibraryVideoPartProps {
  onInspect: (videoId: string) => void;
}

export function LibraryVideoTitle({ video, onInspect }: LibraryVideoTitleProps) {
  const { format } = useFormat();
  const { tOr } = useT();

  const title = video.title ?? tOr('browse.untitled', {}, '');
  const seconds = video.durationMs === undefined ? undefined : video.durationMs / MS_PER_SECOND;

  return (
    <div
      data-slot="library-video-title"
      className="tw:flex tw:min-w-0 tw:items-center tw:gap-stack"
    >
      <VideoThumbnail.Root className="tw:w-row-thumb tw:shrink-0">
        <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
        {seconds !== undefined && (
          <VideoThumbnail.Duration
            spoken={unwrapOr(
              format({
                type: 'duration',
                value: seconds,
                options: { style: 'words', unitDisplay: 'long' },
              }),
              ''
            )}
          >
            {unwrapOr(format(videoDuration(seconds)), '')}
          </VideoThumbnail.Duration>
        )}
      </VideoThumbnail.Root>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onInspect(video.id)}
        className="tw:m-0 tw:min-w-0 tw:cursor-pointer tw:truncate tw:border-0 tw:bg-transparent tw:p-0 tw:text-start tw:font-sans tw:text-label tw:text-fg tw:hover:underline tw:focus-ring"
      >
        {title}
      </button>
    </div>
  );
}

export function LibraryVideoActions({ video }: LibraryVideoPartProps) {
  const { tOr } = useT();
  const canEdit = useCan(canUpdateVideo, { video });
  const canSeeAnalytics = useCan(canReadAnalytics, { analytics: { ownerId: video.ownerId } });

  const title = video.title ?? tOr('browse.untitled', {}, '');
  const watchable = video.status === 'READY' && video.visibility !== 'private';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton size="sm" aria-label={tOr('studio.videoActions', { title }, '')}>
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {canEdit && (
          <DropdownMenu.Item asChild>
            <Link to="/upload/edit/$videoId" params={{ videoId: video.id }}>
              {tOr('studio.editVideo', {}, '')}
            </Link>
          </DropdownMenu.Item>
        )}
        {canSeeAnalytics && (
          <DropdownMenu.Item asChild>
            <Link to="/videos/$videoId/analytics" params={{ videoId: video.id }}>
              {tOr('studio.videoAnalytics', {}, '')}
            </Link>
          </DropdownMenu.Item>
        )}
        {watchable && (
          <DropdownMenu.Item asChild>
            <a href={`${WEB_URL}/watch/${video.id}`}>{tOr('studio.watchOnWeb', {}, '')}</a>
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export const LibraryVideoRow = { Title: LibraryVideoTitle, Actions: LibraryVideoActions };
