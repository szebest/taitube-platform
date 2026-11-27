import type { OwnedPlaylistView } from '@vp/api-contracts';

/** The viewer's pinned playlists, the oldest pin first, which is the order their shelves stand in. */
export function pinnedPlaylists(playlists: readonly OwnedPlaylistView[]) {
  return playlists
    .flatMap(({ pinnedAt, ...playlist }) => (pinnedAt === null ? [] : [{ ...playlist, pinnedAt }]))
    .toSorted((left, right) => Date.parse(left.pinnedAt) - Date.parse(right.pinnedAt));
}
