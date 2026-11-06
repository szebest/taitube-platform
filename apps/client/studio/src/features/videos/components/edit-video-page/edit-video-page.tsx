import { useSuspenseQuery } from '@tanstack/react-query';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canManageCaptions } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { LazyCaptionsSection } from '#app/features/captions/components/captions-section/captions-section.lazy';
import { EditVideoForm } from '../edit-video-form/edit-video-form';
import { VideoProcessingStatus } from '../video-processing-status/video-processing-status';

export function EditVideoPage({ videoId }: { videoId: string }) {
  const api = useApi();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.editTitle', { title: video.title ?? '' }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <VideoProcessingStatus videoId={videoId} />
      <EditVideoForm video={video} />
      <Can
        type="rule"
        I={canManageCaptions}
        this={{
          caption: { videoId, ownerId: video.ownerId, visibility: video.visibility },
        }}
      >
        <LazyCaptionsSection videoId={videoId} />
      </Can>
    </div>
  );
}
