import { InputGroupEnd, InputGroupRoot, InputGroupStart } from './input';

export const InputGroup = { Root: InputGroupRoot, Start: InputGroupStart, End: InputGroupEnd };
export type { InputGroupPartProps, InputGroupRootProps, InputProps } from './input';
export { Input } from './input';
export { useInputGroup } from './input.context';
export { inputStyles } from './input.variants';
export type { InputFill, InputShape, InputSize } from './types';
