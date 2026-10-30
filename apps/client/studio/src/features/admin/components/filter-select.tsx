import { useT } from '@vp/intl-react';
import { Field, Select } from '@vp/ui';

const ANY = 'any';

export interface FilterSelectProps<Value extends string> {
  label: string;
  value: Value | undefined;
  options: { value: Value; label: string }[];
  onChange: (value: Value | undefined) => void;
}

/** One filter as a select whose first choice is no filter at all, so a value is always one of `options` or absent. */
export function FilterSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps<Value>) {
  const { tOr } = useT();

  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Select.Root
        value={value ?? ANY}
        onValueChange={(next) => onChange(options.find((option) => option.value === next)?.value)}
      >
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={ANY}>{tOr('studio.adminFilterAll', {}, '')}</Select.Item>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );
}
