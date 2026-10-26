import { createCompoundContext } from '../../lib/create-compound-context';
import type { FieldOrientation, FieldSize } from './types';

export const [FieldContext, useField] = createCompoundContext<{
  orientation: FieldOrientation;
  size: FieldSize;
  invalid: boolean;
  required: boolean;
  controlId: string;
  hintId: string;
  errorId: string;
  describedBy: string | undefined;
  describe: (id: string) => () => void;
}>('Field');
