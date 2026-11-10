import { useT } from '@vp/intl-react';
import { canModerateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { Button } from '@vp/ui';
import { useState } from 'react';
import type { ScreeningCase } from '#app/features/admin/api/admin-screening';
import { useScreeningDecision } from '#app/features/admin/hooks/use-screening-decision';
import { ScreeningRejectDialog } from '../screening-reject-dialog/screening-reject-dialog';

export interface ScreeningActionsProps {
  screening: ScreeningCase;
}

/** What a moderator may do with a case: approve or reject a held video, or dismiss the flags of one that stayed public. */
export function ScreeningActions({ screening }: ScreeningActionsProps) {
  const { tOr } = useT();
  const decide = useScreeningDecision();
  const [rejecting, setRejecting] = useState(false);
  const canDecide = useCan(canModerateVideo, {
    video: { id: screening.videoId, status: screening.status },
  });

  const held = screening.status === 'HELD';
  const flagsOpen = screening.open && !held && screening.decision === null;
  if (!(canDecide && (held || flagsOpen))) {
    return null;
  }

  const title = screening.title ?? tOr('browse.untitled', {}, '');

  return (
    <span className="flex flex-wrap gap-inline">
      {held && (
        <>
          <Button
            variant="ghost"
            size="sm"
            aria-label={tOr('studio.screeningApproveFor', { title }, '')}
            onClick={() => decide.mutate({ kind: 'approve', videoId: screening.videoId })}
          >
            {tOr('studio.screeningApprove', {}, '')}
          </Button>
          <Button
            variant="ghost"
            tone="danger"
            size="sm"
            aria-label={tOr('studio.screeningRejectFor', { title }, '')}
            onClick={() => setRejecting(true)}
          >
            {tOr('studio.screeningReject', {}, '')}
          </Button>
        </>
      )}
      {flagsOpen && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={tOr('studio.screeningDismissFor', { title }, '')}
          onClick={() => decide.mutate({ kind: 'dismiss', videoId: screening.videoId })}
        >
          {tOr('studio.screeningDismiss', {}, '')}
        </Button>
      )}
      {rejecting && (
        <ScreeningRejectDialog
          videoId={screening.videoId}
          title={title}
          onClose={() => setRejecting(false)}
        />
      )}
    </span>
  );
}
