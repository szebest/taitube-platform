import { createCompoundContext } from '../../lib/create-compound-context';
import type { InputFill, InputShape, InputSize } from './types';

export const [InputGroupContext, useInputGroup] = createCompoundContext<{
  variant: InputFill;
  size: InputSize;
  shape: InputShape;
}>('InputGroup');
