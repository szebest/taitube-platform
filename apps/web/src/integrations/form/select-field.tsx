import { Form } from 'react-bootstrap';

import { useFieldContext } from './form-context';

export type SelectFieldProps<T extends string> = {
  label: string;
  ariaLabel?: string;
  options: readonly T[];
};

export function SelectField<T extends string>({
  label,
  ariaLabel = label,
  options,
}: SelectFieldProps<T>) {
  const field = useFieldContext<T>();
  const choose = (value: string) => {
    const chosen = options.find((option) => option === value);
    if (chosen !== undefined) field.handleChange(chosen);
  };

  return (
    <Form.Group controlId={field.name}>
      <Form.Label>{label}</Form.Label>
      <Form.Select
        aria-label={ariaLabel}
        name={field.name}
        value={field.state.value}
        onChange={(event) => choose(event.target.value)}
        onBlur={field.handleBlur}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Form.Select>
    </Form.Group>
  );
}
