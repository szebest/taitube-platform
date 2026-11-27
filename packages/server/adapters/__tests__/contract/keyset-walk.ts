/** The millisecond the paging specs stamp rows into: an hour back, inside every retention window. */
export const SHARED_MILLISECOND = new Date(Date.now() - 3_600_000);

const MAX_PAGES = 20;

/**
 * Walks a keyset listing one row a page, as a client does, and returns the ids it was served.
 * A listing fetches one row past its limit, which is how the walk knows another page follows.
 */
export async function walkOneAtATime<Row, Cursor>(
  page: (cursor: Cursor | null) => Promise<readonly Row[]>,
  cursorOf: (row: Row) => Cursor,
  idOf: (row: Row) => string
): Promise<string[]> {
  const served: string[] = [];
  let cursor: Cursor | null = null;
  while (served.length < MAX_PAGES) {
    const rows = await page(cursor);
    const [row] = rows;
    if (!row) break;
    served.push(idOf(row));
    if (rows.length < 2) break;
    cursor = cursorOf(row);
  }
  return served;
}

export interface CreatedAtCursor {
  createdAt: Date;
  id: string;
}

/** `walkOneAtATime` over the usual listing: keyed on `createdAt`, ties broken on `id`. */
export function walkByCreatedAt(
  page: (cursor: CreatedAtCursor | null) => Promise<readonly CreatedAtCursor[]>
): Promise<string[]> {
  return walkOneAtATime(
    page,
    ({ createdAt, id }) => ({ createdAt, id }),
    ({ id }) => id
  );
}
