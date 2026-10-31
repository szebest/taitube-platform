import { useT } from '@vp/intl-react';
import { isErr } from '@vp/result';
import { cn, Field, Textarea } from '@vp/ui';
import { PICK_NOTE_MAX_LENGTH, validatePickNote } from '@vp/validation';

export interface PickNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** What the API refused about the note, when the browser's own check let it through. */
  refused: boolean;
}

/** The editorial line, counted against its limit as it is typed. */
export function PickNoteField({ value, onChange, refused }: PickNoteFieldProps) {
  const { tOr } = useT();
  const tooLong = isErr(validatePickNote(value)) || refused;
  const count = Array.from(value.trim()).length;

  return (
    <Field.Root invalid={tooLong}>
      <Field.Label>{tOr('studio.pickNote', {}, '')}</Field.Label>
      <Textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
      <p
        className={cn(
          'tw:m-0 tw:text-caption',
          tooLong ? 'tw:text-danger-ink' : 'tw:text-fg-muted'
        )}
        aria-live="polite"
      >
        {tOr('studio.pickNoteCount', { count, max: PICK_NOTE_MAX_LENGTH }, '')}
      </p>
      {tooLong ? (
        <Field.Error>
          {tOr('studio.pickNoteTooLong', { max: PICK_NOTE_MAX_LENGTH }, '')}
        </Field.Error>
      ) : (
        <Field.Hint>{tOr('studio.pickNoteHint', {}, '')}</Field.Hint>
      )}
    </Field.Root>
  );
}
