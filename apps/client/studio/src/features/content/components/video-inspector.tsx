import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { canReadAnalytics, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { Button, Skeleton } from '@vp/ui';

import { VideoStatusBadge } from './video-status-badge';

function VideoDetails({ video }: { video: Video }) {
  const { tOr } = useT();
  const canEdit = useCan(canUpdateVideo, { video });
  const canSeeAnalytics = useCan(canReadAnalytics, { analytics: { ownerId: video.ownerId } });

  return (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      <h3 className="tw:text-label">{video.title ?? tOr('browse.untitled', {}, '')}</h3>
      <VideoStatusBadge status={video.status} />
      <dl className="tw:grid tw:grid-cols-2 tw:gap-inline tw:text-caption tw:text-fg-muted">
        <dt>{tOr('studio.libraryColumnVisibility', {}, '')}</dt>
        <dd>{tOr('videos.visibility', { visibility: video.visibility }, '')}</dd>
        <dt>{tOr('studio.libraryColumnDate', {}, '')}</dt>
        <dd>
          <Format value={publishedAt(video.createdAt).relative} />
        </dd>
      </dl>
      <div className="tw:flex tw:gap-inline">
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link to="/videos/$videoId/edit" params={{ videoId: video.id }}>
              {tOr('studio.editVideo', {}, '')}
            </Link>
          </Button>
        )}
        {canSeeAnalytics && (
          <Button asChild variant="outline" size="sm">
            <Link to="/videos/$videoId/analytics" params={{ videoId: video.id }}>
              {tOr('studio.videoAnalytics', {}, '')}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function VideoInspector({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const { data: video, isError } = useQuery(videoQueryOptions(api, videoId));

  if (isError) {
    return <p role="alert">{tOr('studio.inspectorFailed', {}, '')}</p>;
  }

  return video === undefined ? (
    <Skeleton shape="text" className="tw:w-full" />
  ) : (
    <VideoDetails video={video} />
  );
}
