import type { PlaylistView } from '@vp/api-contracts';

type PlaylistItem = PlaylistView['items'][number];

/** One item moved to another place: the index it lands on, and the wire position the server takes. */
export interface ItemMove {
  itemId: string;
  toIndex: number;
  newPosition: number;
}

export function planMove(
  items: readonly PlaylistItem[],
  itemId: string,
  toIndex: number
): ItemMove | undefined {
  const from = items.findIndex((item) => item.id === itemId);
  const target = items[toIndex];
  if (from < 0 || from === toIndex || !target) return undefined;

  return { itemId, toIndex, newPosition: target.position };
}

/** The one move a drop made, from the items as they were and the order of ids it left. */
export function planDrop(
  items: readonly PlaylistItem[],
  order: readonly string[]
): ItemMove | undefined {
  const before = items.map(({ id }) => id);
  const first = before.findIndex((id, index) => order[index] !== id);
  const last = before.findLastIndex((id, index) => order[index] !== id);
  const firstId = before[first];
  const lastId = before[last];
  if (firstId === undefined || lastId === undefined) return undefined;

  return order[last] === firstId ? planMove(items, firstId, last) : planMove(items, lastId, first);
}

/** The items after `move`; each place keeps the position it had, since only the order changed. */
export function applyMove(items: readonly PlaylistItem[], move: ItemMove): PlaylistItem[] {
  const next = [...items];
  const from = next.findIndex((item) => item.id === move.itemId);
  const [moved] = next.splice(from, 1);
  if (!moved) return next;

  next.splice(move.toIndex, 0, moved);
  return next.map((item, index) => ({
    ...item,
    position: items[index]?.position ?? item.position,
  }));
}
