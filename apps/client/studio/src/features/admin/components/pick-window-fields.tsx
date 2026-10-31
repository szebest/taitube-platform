import { useT } from '@vp/intl-react';
import { Callout, Field, Input } from '@vp/ui';

import { usePickWindowText } from '#app/features/admin/hooks/use-pick-window-text';
import type { WindowIssue } from '#app/features/admin/lib/pick-schedule';

export interface PickWindowFieldsProps {
  startsAt: string;
  endsAt: string;
  onChange: (changes: { startsAt?: string; endsAt?: string }) => void;
  issue: WindowIssue | undefined;
}

/** The two instants of the window, with what is wrong with them shown as they are typed, before anything is saved. */
export function PickWindowFields({ startsAt, endsAt, onChange, issue }: PickWindowFieldsProps) {
  const { tOr } = useT();
  const windowText = usePickWindowText();

  const message = (() => {
    switch (issue?.kind) {
      case 'invalid':
        return issue.message;
      case 'incomplete':
        return tOr('studio.pickWindowRequired', {}, '');
      case 'overlap':
        return tOr(
          'studio.pickWindowOverlap',
          {
            title: issue.pick.video.title ?? tOr('studio.pickUntitled', {}, ''),
            window: windowText(issue.pick),
          },
          ''
        );
      case undefined:
        return undefined;
    }
  })();

  return (
    <div className="tw:flex tw:flex-col tw:gap-inline">
      <div className="tw:grid tw:gap-stack tw:medium:grid-cols-2">
        <Field.Root invalid={message !== undefined}>
          <Field.Label>{tOr('studio.pickStarts', {}, '')}</Field.Label>
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => onChange({ startsAt: event.target.value })}
          />
        </Field.Root>
        <Field.Root invalid={message !== undefined}>
          <Field.Label>{tOr('studio.pickEnds', {}, '')}</Field.Label>
          <Input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => onChange({ endsAt: event.target.value })}
          />
        </Field.Root>
      </div>
      {message !== undefined && (
        <Callout.Root tone="danger" role="alert">
          <Callout.Icon />
          <Callout.Body>{message}</Callout.Body>
        </Callout.Root>
      )}
    </div>
  );
}
