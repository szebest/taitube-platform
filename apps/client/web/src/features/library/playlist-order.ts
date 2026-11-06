export type PlaylistEdge = 'top' | 'bottom';

/** `ids` with `id` moved to the first or the last place. */
export function moveToEdge(ids: readonly string[], id: string, edge: PlaylistEdge): string[] {
  const rest = ids.filter((candidate) => candidate !== id);
  return edge === 'top' ? [id, ...rest] : [...rest, id];
}
