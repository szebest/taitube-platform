import { Link } from '@tanstack/react-router';
import type { VideoSummary } from '@vp/api-contracts';
import { publishedAt, videoDuration } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { Avatar, Skeleton } from '@vp/ui';

export interface VideoCardProps {
  video: VideoSummary;
}

const MS_PER_SECOND = 1000;

export function VideoCard({ video }: VideoCardProps) {
  const { tOr } = useT();

  const { channel } = video;
  const thumbnailUrl = video.thumbnailUrl ?? video.posterUrl;
  const title = video.title ?? tOr('browse.untitled', {}, '');
  const published = publishedAt(video.createdAt);

  return (
    <article className="tw:relative tw:flex tw:flex-col tw:gap-3">
      <div className="tw:relative tw:aspect-video tw:overflow-hidden tw:rounded-xl tw:bg-tint">
        {thumbnailUrl && (
          <img src={thumbnailUrl} alt="" loading="lazy" className="tw:size-full tw:object-cover" />
        )}
        {video.durationMs !== undefined && (
          <span className="tw:absolute tw:right-1.5 tw:bottom-1.5 tw:rounded-sm tw:bg-scrim tw:px-1 tw:text-xs tw:font-medium tw:text-on-live tw:tabular-nums">
            <Format value={videoDuration(video.durationMs / MS_PER_SECOND)} />
          </span>
        )}
      </div>
      <div className="tw:flex tw:gap-3">
        {channel && (
          <Link
            to="/channel/$channelId"
            params={{ channelId: channel.id }}
            className="tw:relative tw:z-10 tw:h-fit tw:rounded-full tw:focus-ring"
          >
            <Avatar name={channel.displayName} src={channel.avatarUrl} />
          </Link>
        )}
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <Link
            to="/watch/$videoId"
            params={{ videoId: video.id }}
            className="tw:line-clamp-2 tw:font-medium tw:text-fg tw:no-underline tw:focus-ring tw:after:absolute tw:after:inset-0 tw:after:content-['']"
          >
            {title}
          </Link>
          <div className="tw:flex tw:flex-col tw:text-sm tw:text-fg-muted">
            {channel && (
              <Link
                to="/channel/$channelId"
                params={{ channelId: channel.id }}
                className="tw:relative tw:z-10 tw:w-fit tw:truncate tw:text-fg-muted tw:no-underline tw:hover:text-fg"
              >
                {channel.displayName}
              </Link>
            )}
            <span>
              {tOr('videos.views', { count: video.viewsCount ?? 0 }, '')}
              {' · '}
              <time dateTime={video.createdAt}>
                <Format value={published.relative} />
              </time>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <Skeleton className="tw:aspect-video tw:rounded-xl" />
      <div className="tw:flex tw:gap-3">
        <Skeleton className="tw:size-9 tw:shrink-0 tw:rounded-full" />
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-2">
          <Skeleton className="tw:h-4 tw:w-11/12" />
          <Skeleton className="tw:h-3 tw:w-1/2" />
          <Skeleton className="tw:h-3 tw:w-2/3" />
        </div>
      </div>
    </div>
  );
}
