import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { useUiCopy } from '../../copy/ui-copy';
import { fillCopy } from '../../lib/fill-copy';
import { Icon } from '../icon';
import {
  SortableItemContext,
  SortableListContext,
  useSortableItem,
  useSortableList,
} from './sortable-list.context';
import { sortableListStyles } from './sortable-list.variants';
import type { SortableOrientation } from './types';

const DRAG_DISTANCE_PX = 4;

export interface SortableListRootProps extends ComponentPropsWithRef<'ul'> {
  items: readonly string[];
  onReorder: (next: readonly string[]) => void;
  orientation?: SortableOrientation;
}

/** Calls `onReorder` once, on drop, with the final order; the caller owns the data and its persistence. */
export function SortableListRoot({
  items,
  onReorder,
  orientation = 'vertical',
  className,
  ...props
}: SortableListRootProps) {
  const copy = useUiCopy();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const shared = useMemo(
    () => ({ orientation, disabled: props['aria-disabled'] === true }),
    [orientation, props['aria-disabled']]
  );

  const place = (id: string | number | undefined) => items.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      fillCopy(copy.pickedUp, {
        name: String(active.data.current?.name ?? active.id),
        position: place(active.id),
        count: items.length,
      }),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? fillCopy(copy.movedTo, { position: place(over.id) })
        : undefined,
    onDragEnd: ({ over, active }) =>
      fillCopy(copy.droppedAt, { position: place(over?.id ?? active.id) }),
    onDragCancel: () => copy.cancelled,
  };

  const drop = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(
      arrayMove([...items], items.indexOf(String(active.id)), items.indexOf(String(over.id)))
    );
  };

  return (
    <SortableListContext value={shared}>
      <DndContext sensors={sensors} accessibility={{ announcements }} onDragEnd={drop}>
        <SortableContext
          items={[...items]}
          strategy={
            orientation === 'vertical' ? verticalListSortingStrategy : horizontalListSortingStrategy
          }
        >
          <ul
            data-slot="sortable-list"
            className={sortableListStyles({ orientation }).root({ className })}
            {...props}
          />
        </SortableContext>
      </DndContext>
    </SortableListContext>
  );
}

export interface SortableListItemProps extends ComponentPropsWithRef<'li'> {
  id: string;
}

/** Its `aria-label`, or else its id, is the name the announcements and the handle use. */
export function SortableListItem({
  id,
  className,
  style,
  'aria-label': label,
  ...props
}: SortableListItemProps) {
  const { orientation } = useSortableList();
  const name = label ?? id;
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { name } });
  const shared = useMemo(
    () => ({ name, isPickedUp: isDragging, attributes, listeners, setActivatorNodeRef }),
    [name, isDragging, attributes, listeners, setActivatorNodeRef]
  );

  return (
    <SortableItemContext value={shared}>
      <li
        ref={setNodeRef}
        data-slot="sortable-list-item"
        aria-label={label}
        className={sortableListStyles({ orientation, pickedUp: isDragging }).item({ className })}
        style={{ transform: CSS.Transform.toString(transform), transition, ...style }}
        {...props}
      />
    </SortableItemContext>
  );
}

export interface SortableListHandleProps extends ComponentPropsWithRef<'button'> {
  asChild?: boolean;
}

/** The only place a drag starts, so the text in the row stays selectable. */
export function SortableListHandle({
  asChild = false,
  className,
  children,
  ...props
}: SortableListHandleProps) {
  const { disabled } = useSortableList();
  const { name, attributes, listeners, setActivatorNodeRef } = useSortableItem();
  const { reorder } = useUiCopy();
  const Element = asChild ? Slot.Root : 'button';

  if (disabled) return null;

  return (
    <Element
      ref={setActivatorNodeRef}
      type={asChild ? undefined : 'button'}
      data-slot="sortable-list-handle"
      aria-label={fillCopy(reorder, { name })}
      className={sortableListStyles().handle({ className })}
      {...attributes}
      {...listeners}
      {...props}
    >
      {children ?? <Icon name="grip" size="sm" />}
    </Element>
  );
}
