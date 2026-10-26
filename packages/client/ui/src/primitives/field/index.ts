import { FieldControl, FieldError, FieldHint, FieldLabel, FieldRoot } from './field';

export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Hint: FieldHint,
  Error: FieldError,
};
export type { FieldRootProps } from './field';
export { useFieldControl, useFieldSize } from './field';
export { useField } from './field.context';
export { fieldStyles } from './field.variants';
export type { FieldOrientation, FieldSize } from './types';
