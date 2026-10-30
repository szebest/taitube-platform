import { Link } from '@tanstack/react-router';
import type { ContractResult, listCreatorVideos, VideoSummary } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { publishedAt, videoDuration } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { canReadAnalytics, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { unwrapOr } from '@vp/result';
import { Badge, type BadgeTone, DropdownMenu, Icon, IconButton, type IconId } from '@vp/ui';

import { WEB_URL } from '#app/config';

const MS_PER_SECOND = 1000;

export type CreatorVideo = ContractResult<typeof listCreatorVideos>['items'][number];

const STATUS_LOOK = {
  UPLOADING: { tone: 'neutral', icon: 'upload' },
  UPLOADED: { tone: 'neutral', icon: 'clock' },
  PROBING: { tone: 'neutral', icon: 'clock' },
  PROCESSING: { tone: 'info', icon: 'clock' },
  READY: { tone: 'success', icon: 'check' },
  FAILED: { tone: 'danger', icon: 'alert' },
  REJECTED: { tone: 'danger', icon: 'shield' },
  ABANDONED: { tone: 'warning', icon: 'alert' },
  DELETED: { tone: 'neutral', icon: 'trash' },
} as const satisfies Record<VideoSummary['status'], { tone: BadgeTone; icon: IconId }>;

interface LibraryVideoRowProps {
  video: CreatorVideo;
  onInspect: (videoId: string) => void;
}

/** One video of the creator's library: its frame, title, status, visibility and numbers, and what the creator may do with it. */
export function LibraryVideoRow({ video, onInspect }: LibraryVideoRowProps) {
  const { format } = useFormat();
  const { tOr } = useT();
  const canEdit = useCan(canUpdateVideo, { video });
  const canSeeAnalytics = useCan(canReadAnalytics, { analytics: { ownerId: video.ownerId } });

  const title = video.title ?? tOr('browse.untitled', {}, '');
  const seconds = video.durationMs === undefined ? undefined : video.durationMs / MS_PER_SECOND;
  const status = STATUS_LOOK[video.status];
  const watchable = video.status === 'READY' && video.visibility !== 'private';

  return (
    <div data-slot="library-video-row" className="tw:flex tw:min-w-0 tw:items-center tw:gap-stack">
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
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-inline">
        <button
          type="button"
          onClick={() => onInspect(video.id)}
          className="tw:m-0 tw:cursor-pointer tw:truncate tw:border-0 tw:bg-transparent tw:p-0 tw:text-start tw:font-sans tw:text-label tw:text-fg tw:hover:underline tw:focus-ring"
        >
          {title}
        </button>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-inline tw:text-caption tw:text-fg-muted">
          <Badge size="sm" tone={status.tone}>
            <Icon name={status.icon} size="sm" />
            {tOr('studio.videoStatus', { status: video.status }, '')}
          </Badge>
          <span>{tOr('videos.visibility', { visibility: video.visibility }, '')}</span>
          <span className="tw:tabular-nums">
            {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
          </span>
          <time dateTime={video.createdAt}>
            <Format value={publishedAt(video.createdAt).relative} />
          </time>
        </div>
      </div>
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
    </div>
  );
}
