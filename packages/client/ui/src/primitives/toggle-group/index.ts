import { ToggleGroupItem, ToggleGroupRoot } from './toggle-group';

export const ToggleGroup = { Root: ToggleGroupRoot, Item: ToggleGroupItem };
export type { ToggleGroupItemProps, ToggleGroupRootProps } from './toggle-group';
export { useToggleGroup } from './toggle-group.context';
export { toggleGroupStyles } from './toggle-group.variants';
export type { ToggleFill, ToggleShape, ToggleSize } from './types';
