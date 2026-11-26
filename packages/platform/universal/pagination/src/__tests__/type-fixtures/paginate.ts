import { type Page, Paginator } from '../../index';

interface Row {
  readonly id: number;
  readonly title: string;
}

const paginator = new Paginator();
const rows: Row[] = [];

const page = paginator.paginate(rows, 10, {
  cursorOf: (row) => ({ id: row.id }),
  toItem: (row) => row.title,
});

expectTypeOf(page).toEqualTypeOf<Page<string>>();

paginator.paginate(rows, 10, {
  // @ts-expect-error the cursor must be a flat record of strings and numbers
  cursorOf: (row) => ({ row }),
  toItem: (row) => row.title,
});

// @ts-expect-error toItem is required
paginator.paginate(rows, 10, { cursorOf: (row) => ({ id: row.id }) });
