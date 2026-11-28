import { Field, Select } from '@kit/ui';

export interface LabelledSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface LabelledSelectProps {
  label: string;
  value: string;
  options: readonly LabelledSelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function LabelledSelect({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
}: LabelledSelectProps) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </Field.Root>
  );
}
