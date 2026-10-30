import { useSuspenseQuery } from '@tanstack/react-query';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';

import { EditVideoForm } from './edit-video-form';
import { VideoProcessingStatus } from './video-processing-status';

export function EditVideoPage({ videoId }: { videoId: string }) {
  const api = useApi();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.editTitle', { title: video.title ?? '' }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <VideoProcessingStatus videoId={videoId} />
      <EditVideoForm video={video} />
    </div>
  );
}
