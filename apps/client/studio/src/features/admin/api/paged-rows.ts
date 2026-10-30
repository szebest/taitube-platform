import type { ComponentProps } from 'react';

import type { DataTable } from '#app/components/table/data-table';

type TableState = NonNullable<ComponentProps<typeof DataTable.Root>['state']>;

/** A `select` for an infinite query of keyset pages: every row loaded so far, in order. */
export const pagedRows = <Row>({ pages }: { pages: readonly { items: readonly Row[] }[] }) =>
  pages.flatMap(({ items }) => items);

/** What a table over a query shows: a failure only replaces rows there are none of. */
export function tableStateOf(
  { isPending, isError }: { isPending: boolean; isError: boolean },
  rowCount: number
): TableState {
  if (isPending) {
    return 'loading';
  }
  if (isError && rowCount === 0) {
    return 'error';
  }

  return rowCount === 0 ? 'empty' : 'ready';
}
