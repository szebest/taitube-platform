import { useT } from '@vp/intl-react';
import { fromPromise, isOk, unwrapOr } from '@vp/result';
import { Button, Dialog, useToast, useUiCopy } from '@vp/ui';
import { validatePickNote } from '@vp/validation';
import { useState } from 'react';

import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { type PickFailure, pickFailureOf } from '#app/features/admin/api/pick-failures';
import { useCreatePick, useUpdatePick } from '#app/features/admin/hooks/use-pick-mutations';
import {
  changesOf,
  draftIssues,
  hasIssues,
  type PickDraft,
} from '#app/features/admin/lib/pick-draft';
import { defaultWindow, fromLocalInput, toLocalInput } from '#app/features/admin/lib/pick-schedule';
import { PickDraftFields, type ShownIssues } from './pick-draft-fields';

export interface PickDialogProps {
  /** The pick being edited; none schedules a new one. */
  pick?: AdminPick;
  /** Every pick on the calendar, which the window is checked against. */
  picks: readonly AdminPick[];
  onClose: () => void;
  /** Asks to cancel the pick being edited. */
  onCancelPick?: () => void;
}

const draftOf = (pick: AdminPick | undefined, now: Date): PickDraft =>
  pick
    ? {
        video: pick.video,
        startsAt: toLocalInput(pick.startsAt),
        endsAt: toLocalInput(pick.endsAt),
        note: pick.note ?? '',
      }
    : { video: null, note: '', ...defaultWindow(now) };

/** Schedules a pick, or edits `pick`; the window is checked against the calendar by the rules the API runs. */
export function PickDialog({ pick, picks, onClose, onCancelPick }: PickDialogProps) {
  const { tOr } = useT();
  const { cancel, save } = useUiCopy();
  const toast = useToast();
  const create = useCreatePick();
  const update = useUpdatePick();
  const [now] = useState(() => new Date());
  const [draft, setDraft] = useState(() => draftOf(pick, now));
  const [attempted, setAttempted] = useState(false);
  const [refused, setRefused] = useState<PickFailure>();

  const issues = draftIssues(draft, { picks, exceptId: pick?.id, now });
  const shown: ShownIssues = {
    video: (() => {
      if (refused?.kind === 'field' && refused.field === 'videoId') {
        return tOr('studio.pickVideoRefused', {}, '');
      }
      return attempted && issues.video ? tOr('studio.pickVideoRequired', {}, '') : undefined;
    })(),
    window: (() => {
      if (refused?.kind === 'overlap') {
        return { kind: 'invalid' as const, message: tOr('errors.pickWindowOverlap', {}, '') };
      }
      if (refused?.kind === 'field' && ['startsAt', 'endsAt'].includes(refused.field)) {
        return { kind: 'invalid' as const, message: tOr('studio.pickWindowRefused', {}, '') };
      }
      return issues.window?.kind === 'incomplete' && !attempted ? undefined : issues.window;
    })(),
    note: issues.note || (refused?.kind === 'field' && refused.field === 'note'),
  };

  const change = (changes: Partial<PickDraft>) => {
    setRefused(undefined);
    setDraft((previous) => ({ ...previous, ...changes }));
  };

  const submit = async () => {
    setAttempted(true);
    const { video } = draft;
    const startsAt = fromLocalInput(draft.startsAt);
    const endsAt = fromLocalInput(draft.endsAt);
    if (hasIssues(issues) || !(video && startsAt && endsAt)) {
      return;
    }

    const next = {
      videoId: video.id,
      startsAt,
      endsAt,
      note: unwrapOr(validatePickNote(draft.note), null),
    };
    const changes = pick && changesOf(pick, next);
    if (pick && !changes) {
      onClose();
      return;
    }

    const saved = await fromPromise(
      () =>
        pick && changes
          ? update.mutateAsync({ id: pick.id, changes })
          : create.mutateAsync({
              ...next,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
            }),
      (cause) => cause
    );
    if (isOk(saved)) {
      onClose();
      return;
    }

    const failure = pickFailureOf(saved.error);
    if (failure.kind === 'other') {
      toast({ tone: 'danger', title: tOr('studio.pickSaveFailed', {}, '') });
    }
    setRefused(failure);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content size="lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Dialog.Header>
            <Dialog.Title>
              {tOr(pick ? 'studio.pickEditTitle' : 'studio.pickCreateTitle', {}, '')}
            </Dialog.Title>
            <Dialog.Description>{tOr('studio.pickDialogDescription', {}, '')}</Dialog.Description>
          </Dialog.Header>
          <Dialog.Body>
            <PickDraftFields draft={draft} onChange={change} issues={shown} />
          </Dialog.Body>
          <Dialog.Footer>
            {onCancelPick && (
              <Button variant="outline" tone="danger" onClick={onCancelPick}>
                {tOr('studio.pickCancelAction', {}, '')}
              </Button>
            )}
            <Dialog.Close asChild>
              <Button variant="outline">{cancel}</Button>
            </Dialog.Close>
            <Button
              type="submit"
              variant="solid"
              tone="accent"
              loading={create.isPending || update.isPending}
            >
              {save}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
