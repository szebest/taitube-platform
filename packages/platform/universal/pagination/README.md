# @kit/pagination

Keyset pagination: a `Paginator` that clamps a requested page size, trims a `limit + 1` row window to a page and
mints the next cursor, and a `CursorCodec` that decides how a cursor travels. The default codec is base64url JSON
and runs in Node, Bun and the browser.

Install: `pnpm add @kit/pagination`. It depends on `@kit/result` and `@kit/errors`.

Tokens: none. The page size bounds are the `defaultLimit` and `maxLimit` options of `Paginator`, which the app
resolves at its composition root. A different wire format is a `CursorCodec` passed as `cursorCodec`.

```ts
import { Paginator } from '@kit/pagination';

const paginator = new Paginator({ defaultLimit: 20, maxLimit: 100 });

const limit = paginator.limit(requested);
const rows = await load(paginator.window(limit));
const page = paginator.paginate(rows, limit, {
  cursorOf: (row) => ({ createdAt: row.createdAt, id: row.id }),
  toItem: (row) => row,
});
```

A broken cursor is `err(invalidCursor())`, an input failure with the code `INVALID_CURSOR` and the field `cursor`.
The app adds `PaginationErrorCodes` to its error code set, so it never writes the code itself.
