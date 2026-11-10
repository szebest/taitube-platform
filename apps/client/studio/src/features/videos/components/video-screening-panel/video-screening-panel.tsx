import { useQuery } from '@tanstack/react-query';
import type { Video } from '@vp/api-contracts';
import { SectionError } from '@vp/components';
import { ErrorCodes } from '@vp/errors';
import { useT } from '@vp/intl-react';
import { canAppealVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { videoScreeningQueryOptions } from '#app/features/videos/api/video-screening';
import { ScreeningAppealForm } from '../screening-appeal-form/screening-appeal-form';

export interface VideoScreeningPanelProps {
  video: Video;
}

/** Why a held or screening-rejected video is not public, in plain words, with the appeal the owner may send and its outcome. */
export function VideoScreeningPanel({ video }: VideoScreeningPanelProps) {
  const api = useApi();
  const { tOr } = useT();
  const held = video.status === 'HELD';
  const rejected = video.status === 'REJECTED';
  const {
    data: screening,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    ...videoScreeningQueryOptions(api, video.id),
    enabled: held || rejected,
  });
  const canAppeal = useCan(canAppealVideo, {
    video: {
      ...video,
      errorCode: screening?.decision === 'rejected' ? ErrorCodes.SCREENING_REJECTED : null,
    },
  });

  if (!(held || rejected)) {
    return null;
  }

  if (isError) {
    return (
      <SectionError.Root
        role="alert"
        tone="warning"
        retrying={isFetching}
        onRetry={() => refetch()}
      >
        <SectionError.Message>{tOr('studio.creatorScreeningFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }

  if (!screening || (rejected && screening.decision === null)) {
    return null;
  }

  const { appeal, reasons, decisionNote } = screening;

  return (
    <section
      aria-label={tOr(
        held ? 'studio.creatorScreeningHeldTitle' : 'studio.creatorScreeningRejectedTitle',
        {},
        ''
      )}
      className="flex flex-col gap-stack rounded-card border border-divider p-inset-card"
    >
      <h2 className="m-0 text-title">
        {tOr(
          held ? 'studio.creatorScreeningHeldTitle' : 'studio.creatorScreeningRejectedTitle',
          {},
          ''
        )}
      </h2>
      {held && <p className="m-0">{tOr('studio.creatorScreeningHeldBody', {}, '')}</p>}
      {reasons.length > 0 && (
        <ul className="m-0 flex flex-col gap-inline">
          {reasons.map((reason) => (
            <li key={reason}>{tOr('studio.creatorScreeningReason', { reason }, '')}</li>
          ))}
        </ul>
      )}
      {decisionNote && (
        <p className="m-0">{tOr('studio.creatorScreeningNote', { note: decisionNote }, '')}</p>
      )}
      {appeal && (
        <div className="flex flex-col gap-inline">
          <p className="m-0">
            {tOr('studio.creatorScreeningAppealSent', { message: appeal.message }, '')}
          </p>
          <p className="m-0 text-fg-muted">
            {tOr(
              appeal.resolved
                ? 'studio.creatorScreeningAppealDecided'
                : 'studio.creatorScreeningAppealWaiting',
              {},
              ''
            )}
          </p>
        </div>
      )}
      {screening.canAppeal && canAppeal && <ScreeningAppealForm videoId={video.id} />}
    </section>
  );
}
