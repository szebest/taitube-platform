import {
  ShelfAction,
  ShelfHeader,
  ShelfItem,
  ShelfNote,
  ShelfRoot,
  ShelfTitle,
  ShelfTrack,
} from './shelf';

export const Shelf = {
  Root: ShelfRoot,
  Header: ShelfHeader,
  Title: ShelfTitle,
  Note: ShelfNote,
  Action: ShelfAction,
  Track: ShelfTrack,
  Item: ShelfItem,
};
export type { ShelfPartProps, ShelfRootProps, ShelfTrackProps } from './shelf';
export { ShelfSkeleton } from './shelf';
export { useShelf } from './shelf.context';
export { shelfStyles } from './shelf.variants';
