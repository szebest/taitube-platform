/**
 * Items keep a sparse integer sort key, a gap apart, so a drag-and-drop move rewrites the moved
 * row alone: it takes the midpoint between its new neighbours. Only when two neighbours sit
 * adjacent, or a key would leave the integer column, is the whole playlist respaced.
 */
export const POSITION_GAP = 1024;

const MIN_POSITION = -(2 ** 31);
const MAX_POSITION = 2 ** 31 - 1;

export interface PositionedItem {
  readonly id: string;
  readonly position: number;
}

export interface PositionWrite {
  readonly id: string;
  readonly position: number;
}

function inRange(position: number): boolean {
  return position >= MIN_POSITION && position <= MAX_POSITION;
}

/** Null when the slot after `last` would overflow; renumber first, then append. */
export function appendPosition(last: number | null): number | null {
  if (last === null) return 0;
  const next = last + POSITION_GAP;
  return inRange(next) ? next : null;
}

export function renumberPositions(order: readonly string[]): PositionWrite[] {
  return order.map((id, index) => ({ id, position: index * POSITION_GAP }));
}

function slotBetween(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined) return after === undefined ? null : after - POSITION_GAP;
  if (after === undefined) return before + POSITION_GAP;
  return after - before > 1 ? before + Math.floor((after - before) / 2) : null;
}

/**
 * The writes that put `itemId` at `index` of the ordered `items`, clamped to the end. Null when
 * the playlist does not hold the item; empty when it already sits there.
 */
export function movePositions(
  items: readonly PositionedItem[],
  itemId: string,
  index: number
): PositionWrite[] | null {
  const from = items.findIndex((item) => item.id === itemId);
  if (from === -1) return null;

  const others = items.filter((item) => item.id !== itemId);
  const to = Math.min(Math.max(index, 0), others.length);
  if (to === from) return [];

  const slot = slotBetween(others[to - 1]?.position, others[to]?.position);
  if (slot !== null && inRange(slot)) return [{ id: itemId, position: slot }];

  const order = others.map((item) => item.id);
  order.splice(to, 0, itemId);
  return renumberPositions(order);
}
