import { Field, Select } from '@vp/ui';

import { useFieldContext } from './form-context';

export type SelectFieldProps<T extends string> = {
  label: string;
  ariaLabel?: string;
  options: readonly T[];
};

export function SelectField<T extends string>({ label, ariaLabel, options }: SelectFieldProps<T>) {
  const field = useFieldContext<T>();
  const choose = (value: string) => {
    const chosen = options.find((option) => option === value);
    if (chosen !== undefined) field.handleChange(chosen);
  };

  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Select.Root name={field.name} value={field.state.value} onValueChange={choose}>
        <Select.Trigger aria-label={ariaLabel} onBlur={field.handleBlur}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option} value={option}>
              {option}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );
}
