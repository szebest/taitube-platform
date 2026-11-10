import {
  BAN_DURATIONS,
  type BanDuration,
  COMMENT_MODERATION_REASONS,
  type CommentModerationReason,
} from '@vp/domain';
import { useT } from '@vp/intl-react';
import { Button, Dialog, Field, Kbd, Select, Textarea, ToggleGroup, useUiCopy } from '@vp/ui';
import { type KeyboardEvent, useState } from 'react';

export type ReasonedAction = 'hide' | 'remove' | 'ban';

export interface ModerationReason {
  reason: CommentModerationReason;
  note: string | undefined;
  duration: BanDuration;
}

export interface ModerationReasonDialogProps {
  action: ReasonedAction | null;
  pending?: boolean;
  onConfirm: (details: ModerationReason) => void;
  onCancel: () => void;
}

const isReason = (value: string): value is CommentModerationReason =>
  COMMENT_MODERATION_REASONS.some((reason) => reason === value);

const isDuration = (value: string): value is BanDuration =>
  BAN_DURATIONS.some((duration) => duration === value);

const isTyping = (target: EventTarget) =>
  target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;

interface FormProps extends Omit<ModerationReasonDialogProps, 'action'> {
  action: ReasonedAction;
}

function ReasonForm({ action, pending = false, onConfirm, onCancel }: FormProps) {
  const { tOr } = useT();
  const { cancel } = useUiCopy();
  const [reason, setReason] = useState<CommentModerationReason>('spam');
  const [duration, setDuration] = useState<BanDuration>('7d');
  const [note, setNote] = useState('');

  const confirm = () => onConfirm({ reason, note: note.trim() || undefined, duration });

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event.target)) {
      return;
    }
    const picked = COMMENT_MODERATION_REASONS[Number(event.key) - 1];
    if (picked !== undefined) {
      event.preventDefault();
      setReason(picked);
    } else if (event.key === 'Enter' && !pending) {
      event.preventDefault();
      confirm();
    }
  };

  return (
    <form
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <Dialog.Body className="flex flex-col gap-stack">
        <ToggleGroup.Root
          type="single"
          orientation="vertical"
          variant="outline"
          aria-label={tOr('studio.moderationReasonLabel', {}, '')}
          value={reason}
          onValueChange={(next) => isReason(next) && setReason(next)}
        >
          {COMMENT_MODERATION_REASONS.map((option, index) => (
            <ToggleGroup.Item key={option} value={option} aria-keyshortcuts={String(index + 1)}>
              <Kbd size="sm">{index + 1}</Kbd>
              {tOr('studio.moderationReasonOption', { reason: option }, '')}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        {action === 'ban' && (
          <Field.Root>
            <Field.Label>{tOr('studio.moderationDurationLabel', {}, '')}</Field.Label>
            <Select.Root
              value={duration}
              onValueChange={(next) => isDuration(next) && setDuration(next)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {BAN_DURATIONS.map((option) => (
                  <Select.Item key={option} value={option}>
                    {tOr('studio.moderationDurationOption', { duration: option }, '')}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field.Root>
        )}
        <Field.Root>
          <Field.Label>{tOr('studio.moderationNoteLabel', {}, '')}</Field.Label>
          <Textarea
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field.Root>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onCancel}>
          {cancel}
        </Button>
        <Button type="submit" variant="solid" tone="danger" loading={pending}>
          {tOr('studio.moderationAction', { action }, '')}
          <Kbd size="sm" variant="soft">
            Enter
          </Kbd>
        </Button>
      </Dialog.Footer>
    </form>
  );
}

/** Asks why a comment is hidden or removed, or an author banned: 1 to 6 pick the reason and Enter confirms. */
export function ModerationReasonDialog({ action, ...props }: ModerationReasonDialogProps) {
  const { tOr } = useT();

  return (
    <Dialog.Root open={action !== null} onOpenChange={(open) => !open && props.onCancel()}>
      <Dialog.Content size="sm">
        {action !== null && (
          <>
            <Dialog.Header>
              <Dialog.Title>{tOr('studio.moderationReasonTitle', { action }, '')}</Dialog.Title>
              <Dialog.Description>
                {tOr('studio.moderationReasonDescription', { action }, '')}
              </Dialog.Description>
            </Dialog.Header>
            <ReasonForm action={action} {...props} />
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
