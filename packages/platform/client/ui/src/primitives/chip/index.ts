import { ChipGroupItem, ChipGroupRoot } from './chip';

export const ChipGroup = { Root: ChipGroupRoot, Item: ChipGroupItem };
export type { ChipGroupItemProps, ChipGroupRootProps, ChipProps } from './chip';
export { Chip } from './chip';
export { useChipGroup } from './chip.context';
export { chipStyles } from './chip.variants';
export type { ChipFill, ChipSize } from './types';
