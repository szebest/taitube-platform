import { Button, Field, Input, ResponsiveModal, Select } from '@kit/ui';
import { type FormEvent, useState } from 'react';
import { useT } from '#app/lib/messages';
import type { FieldInput } from './types';

export interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The name of the one field being asked for. */
  label: string;
  input: FieldInput;
  submitLabel: string;
  /** The value, trimmed; a blank text value is not submitted. */
  onSubmit: (value: string) => void;
  pending?: boolean;
}

function FieldForm({
  description,
  label,
  input,
  submitLabel,
  title,
  pending = false,
  onSubmit,
  onCancel,
}: Omit<FieldDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const { tOr } = useT();
  const cancel = tOr('ui.cancel', {}, '');
  const [value, setValue] = useState(
    input.kind === 'choice' ? (input.initial ?? input.options[0]?.value ?? '') : ''
  );
  const blank = value.trim().length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!blank) onSubmit(value.trim());
  };

  return (
    <form onSubmit={submit} noValidate>
      <ResponsiveModal.Header>
        <ResponsiveModal.Title>{title}</ResponsiveModal.Title>
        {description && <ResponsiveModal.Description>{description}</ResponsiveModal.Description>}
      </ResponsiveModal.Header>
      <ResponsiveModal.Body>
        <Field.Root required>
          <Field.Label>{label}</Field.Label>
          {input.kind === 'choice' ? (
            <Select.Root value={value} onValueChange={setValue}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {input.options.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          ) : (
            <Input value={value} onChange={(event) => setValue(event.target.value)} />
          )}
          {input.kind === 'text' && input.hint && <Field.Hint>{input.hint}</Field.Hint>}
        </Field.Root>
      </ResponsiveModal.Body>
      <ResponsiveModal.Footer>
        <Button variant="outline" type="button" onClick={onCancel}>
          {cancel}
        </Button>
        <Button variant="solid" tone="accent" type="submit" loading={pending} disabled={blank}>
          {submitLabel}
        </Button>
      </ResponsiveModal.Footer>
    </form>
  );
}

/**
 * Asks for the value of one field, a choice or a line of text: the one dialog every field edit
 * opens, so adding a field adds a row to the caller's table and no dialog.
 */
export function FieldDialog({ open, onOpenChange, ...form }: FieldDialogProps) {
  return (
    <ResponsiveModal.Root open={open} onOpenChange={onOpenChange}>
      <ResponsiveModal.Content size="sm">
        <FieldForm {...form} onCancel={() => onOpenChange(false)} />
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
