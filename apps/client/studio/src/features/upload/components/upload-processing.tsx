import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { uploadProgress } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { Button, Progress } from '@vp/ui';

import { WEB_URL } from '#app/config';
import { VideoStatusBadge } from '#app/features/content/components/video-status-badge';

/** The thumbnail stage reports its progress under this rendition name. */
const THUMBNAIL_STAGE = '-';

interface UploadStageProps {
  title: string;
  stage: string;
  percent: number;
}

function UploadStage({ title, stage, percent }: UploadStageProps) {
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <div className="tw:flex tw:justify-between tw:text-caption tw:text-fg-muted">
        <span>{stage}</span>
        <Format value={uploadProgress(percent)} />
      </div>
      <Progress
        size="sm"
        aria-label={tOr('studio.uploadStageLabel', { stage, title }, '')}
        value={percent}
      />
    </div>
  );
}

/** What the SSE stream reports about a sent video: its status and each rendition's progress. */
export function UploadProcessing({ videoId, title }: { videoId: string; title: string }) {
  const api = useApi();
  const { data: video, isError } = useQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  if (isError) {
    return <p role="alert">{tOr('studio.uploadProcessingFailed', {}, '')}</p>;
  }
  if (video === undefined) {
    return null;
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-stack">
      <VideoStatusBadge status={video.status} />
      <UploadStage
        title={title}
        stage={tOr('studio.uploadOverall', {}, '')}
        percent={video.progress.overall}
      />
      {Object.entries(video.progress.byRendition).map(([rendition, percent]) => (
        <UploadStage
          key={rendition}
          title={title}
          stage={rendition === THUMBNAIL_STAGE ? tOr('studio.uploadThumbnail', {}, '') : rendition}
          percent={percent}
        />
      ))}
      <div className="tw:flex tw:gap-inline">
        <Button asChild variant="outline" size="sm">
          <Link to="/videos/$videoId/edit" params={{ videoId }}>
            {tOr('studio.editVideo', {}, '')}
          </Link>
        </Button>
        {video.status === 'READY' && (
          <Button asChild variant="outline" size="sm">
            <a href={`${WEB_URL}/watch/${videoId}`}>{tOr('studio.watchOnWeb', {}, '')}</a>
          </Button>
        )}
      </div>
    </div>
  );
}
