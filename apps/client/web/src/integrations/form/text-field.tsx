import { Form } from 'react-bootstrap';

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

  return (
    <Form.Group controlId={field.name}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        as={multiline ? 'textarea' : 'input'}
        type="text"
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        isInvalid={error !== undefined}
        className={className}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}
