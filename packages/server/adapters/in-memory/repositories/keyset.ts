/** The last row of a page: its sort key and the tiebreaker that orders rows sharing one. */
export interface KeysetCursor {
  sort: Date;
  tie: string;
}

function compareKeyset(a: KeysetCursor, b: KeysetCursor): number {
  const delta = a.sort.getTime() - b.sort.getTime();
  return delta !== 0 ? delta : a.tie.localeCompare(b.tie);
}

/** Sort comparator matching the postgres adapter's `ORDER BY <sort> DESC, <tie> DESC`. */
export function byKeysetDesc(a: KeysetCursor, b: KeysetCursor): number {
  return -compareKeyset(a, b);
}

/** Whether a row falls after the cursor in that descending order; every row does without one. */
export function isKeysetBefore(row: KeysetCursor, cursor?: KeysetCursor | null): boolean {
  return !cursor || compareKeyset(row, cursor) < 0;
}
