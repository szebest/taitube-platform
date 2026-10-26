import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { createCompoundContext } from '../../lib/create-compound-context';
import type { SortableOrientation } from './types';

export const [SortableListContext, useSortableList] = createCompoundContext<{
  orientation: SortableOrientation;
  disabled: boolean;
}>('SortableList');

export const [SortableItemContext, useSortableItem] = createCompoundContext<{
  name: string;
  isPickedUp: boolean;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}>('SortableItem');
