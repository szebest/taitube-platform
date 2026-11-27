import { SectionError } from '@kit/components';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useT } from '#app/lib/messages';

export type VideoProcessingStatusProps = { videoId: string };

export function VideoProcessingStatus({ videoId }: VideoProcessingStatusProps) {
  const api = useApi();
  const {
    data: { status, progress },
    isRefetchError,
    isFetching,
    refetch,
  } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <>
      <p role="status" aria-label={tOr('studio.processingStatus', {}, '')}>
        {tOr('studio.processing', { status, overall: progress.overall }, '')}
      </p>
      {isRefetchError && (
        <SectionError.Root
          role="alert"
          tone="warning"
          retrying={isFetching}
          onRetry={() => void refetch()}
        >
          <SectionError.Message>
            {tOr('studio.processingStatusFailed', {}, '')}
          </SectionError.Message>
        </SectionError.Root>
      )}
    </>
  );
}
