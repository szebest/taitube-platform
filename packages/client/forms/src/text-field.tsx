import { Field, Input, Textarea } from '@vp/ui';

import { fieldError } from './field-error';
import { useFieldContext } from './form-context';

export type TextFieldProps = {
  label: string;
  multiline?: boolean;
  className?: string;
};

export function TextField({ label, multiline = false, className }: TextFieldProps) {
  const field = useFieldContext<string>();
  const error = fieldError(field.state.meta);
  const Control = multiline ? Textarea : Input;

  return (
    <Field.Root invalid={error !== undefined} className={className}>
      <Field.Label>{label}</Field.Label>
      <Control
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
      />
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}
