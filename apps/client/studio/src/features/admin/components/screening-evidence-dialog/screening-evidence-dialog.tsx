import { useT } from '@vp/intl-react';
import { Button, Dialog, useUiCopy } from '@vp/ui';
import type { ScreeningCase } from '#app/features/admin/api/admin-screening';
import { ScreeningFinding } from '../screening-finding/screening-finding';

export interface ScreeningEvidenceDialogProps {
  screening: ScreeningCase;
  onClose: () => void;
}

/** Everything the check kept about one video, beside the limits of the matcher, so a moderator reads it before deciding. */
export function ScreeningEvidenceDialog({ screening, onClose }: ScreeningEvidenceDialogProps) {
  const { tOr } = useT();
  const { close } = useUiCopy();
  const { appeal, decisionNote } = screening;
  const title = screening.title ?? tOr('browse.untitled', {}, '');
  const findings = [...screening.reasons, ...screening.flags];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="lg">
        <Dialog.Header>
          <Dialog.Title>{tOr('studio.screeningEvidenceFor', { title }, '')}</Dialog.Title>
          <Dialog.Description>
            {tOr('studio.screeningEvidenceDescription', {}, '')}
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <div className="flex flex-col gap-stack">
            {appeal && (
              <section className="flex flex-col gap-inline">
                <h3 className="m-0 text-label">{tOr('studio.screeningAppealHeading', {}, '')}</h3>
                <p className="m-0">{appeal.message}</p>
              </section>
            )}
            {decisionNote && (
              <p className="m-0">
                {tOr('studio.screeningDecisionNote', { note: decisionNote }, '')}
              </p>
            )}
            {findings.map((finding) => (
              <ScreeningFinding key={`${finding.reason}-${finding.score}`} finding={finding} />
            ))}
            <section className="flex flex-col gap-inline">
              <h3 className="m-0 text-label">{tOr('studio.screeningLimitsTitle', {}, '')}</h3>
              <p className="m-0 text-caption text-fg-muted">
                {tOr('studio.screeningLimits', {}, '')}
              </p>
            </section>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button variant="outline">{close}</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
