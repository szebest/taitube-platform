import { useSuspenseQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';

export type VideoProcessingStatusProps = { videoId: string };

export function VideoProcessingStatus({ videoId }: VideoProcessingStatusProps) {
  const api = useApi();
  const {
    data: { status, progress },
  } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <p role="status" aria-label={tOr('studio.processingStatus', {}, '')}>
      {tOr('studio.processing', { status, overall: progress.overall }, '')}
    </p>
  );
}
