import { Link } from '@tanstack/react-router';
import type { ContractResult, listCreatorVideos } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { VIDEO_VISIBILITIES } from '@vp/domain';
import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { canDeleteVideo, canReadAnalytics, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { unwrapOr } from '@vp/result';
import { DropdownMenu, Icon, IconButton } from '@vp/ui';

import { useState } from 'react';

import { WEB_URL } from '#app/config';
import { useBatchActions } from '../hooks/use-batch-actions';
import { DeleteVideosDialog } from './delete-videos-dialog';

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

const VISIBILITY_ORDER = [...VIDEO_VISIBILITIES].reverse();

export function LibraryVideoActions({ video }: LibraryVideoPartProps) {
  const { tOr } = useT();
  const canEdit = useCan(canUpdateVideo, { video });
  const canDelete = useCan(canDeleteVideo, { video });
  const canSeeAnalytics = useCan(canReadAnalytics, { analytics: { ownerId: video.ownerId } });
  const { deleteVideos, setVisibility } = useBatchActions();
  const [confirming, setConfirming] = useState(false);

  const title = video.title ?? tOr('browse.untitled', {}, '');
  const watchable = video.status === 'READY' && video.visibility !== 'private';

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton size="sm" aria-label={tOr('studio.videoActions', { title }, '')}>
            <Icon name="more" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {canEdit && (
            <DropdownMenu.Item asChild>
              <Link to="/videos/$videoId/edit" params={{ videoId: video.id }}>
                {tOr('studio.editVideo', {}, '')}
              </Link>
            </DropdownMenu.Item>
          )}
          {canEdit && (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>
                {tOr('studio.setVisibility', {}, '')}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                {VISIBILITY_ORDER.map((visibility) => (
                  <DropdownMenu.Item
                    key={visibility}
                    onSelect={() => void setVisibility([video], visibility)}
                  >
                    {tOr('videos.visibility', { visibility }, '')}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
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
          {canDelete && (
            <DropdownMenu.Item tone="danger" onSelect={() => setConfirming(true)}>
              {tOr('studio.deleteVideo', {}, '')}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <DeleteVideosDialog
        open={confirming}
        onOpenChange={setConfirming}
        count={1}
        onConfirm={() => void deleteVideos([video])}
      />
    </>
  );
}

export const LibraryVideoRow = { Title: LibraryVideoTitle, Actions: LibraryVideoActions };
