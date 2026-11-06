import { fieldError } from '@vp/forms';
import { Field, Input, Textarea } from '@vp/ui';

interface TextFieldApi {
  name: string;
  state: { value: string; meta: Parameters<typeof fieldError>[0] };
  handleChange: (value: string) => void;
  handleBlur: () => void;
}

interface ChannelTextFieldProps {
  field: TextFieldApi;
  label: string;
  hint?: string;
  multiline?: boolean;
  /** What the API answered for this field, which outranks the browser's own check. */
  refusal?: string;
}

/** A text control of the channel form over a TanStack field: label, hint and the error the field earned. */
export function ChannelTextField({
  field,
  label,
  hint,
  multiline = false,
  refusal,
}: ChannelTextFieldProps) {
  const error = refusal ?? fieldError(field.state.meta);
  const Control = multiline ? Textarea : Input;

  return (
    <Field.Root invalid={error !== undefined}>
      <Field.Label>{label}</Field.Label>
      <Control
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
      />
      {hint !== undefined && <Field.Hint>{hint}</Field.Hint>}
      {error !== undefined && <Field.Error>{error}</Field.Error>}
    </Field.Root>
  );
}
