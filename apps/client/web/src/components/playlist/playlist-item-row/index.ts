import {
  PlaylistItemRowAdder,
  PlaylistItemRowBody,
  PlaylistItemRowNote,
  PlaylistItemRowRoot,
  PlaylistItemRowSegment,
  PlaylistItemRowSelect,
} from './playlist-item-row';
import {
  PlaylistSectionRowActions,
  PlaylistSectionRowCount,
  PlaylistSectionRowRoot,
  PlaylistSectionRowTitle,
} from './playlist-section-row';

export const PlaylistItemRow = {
  Root: PlaylistItemRowRoot,
  Select: PlaylistItemRowSelect,
  Body: PlaylistItemRowBody,
  Note: PlaylistItemRowNote,
  Segment: PlaylistItemRowSegment,
  Adder: PlaylistItemRowAdder,
};

export const PlaylistSectionRow = {
  Root: PlaylistSectionRowRoot,
  Title: PlaylistSectionRowTitle,
  Count: PlaylistSectionRowCount,
  Actions: PlaylistSectionRowActions,
};

export type {
  PlaylistItemRowAdderProps,
  PlaylistItemRowRootProps,
  PlaylistItemRowSelectProps,
} from './playlist-item-row';
export type { PlaylistSectionRowRootProps } from './playlist-section-row';
export { usePlaylistSectionRow } from './playlist-section-row.context';
export { PlaylistItemRowSkeleton } from './components/playlist-item-row-skeleton/playlist-item-row-skeleton';
