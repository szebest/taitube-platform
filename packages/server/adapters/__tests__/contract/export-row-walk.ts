import type { Result } from '@kit/result';
import { expectOk } from '@kit/testing/result';
import type { ExportScope } from '@vp/core/repositories';
import type { ExportRowPage } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type Pager<Row> = (
  scope: ExportScope,
  after: string | null,
  limit: number
) => Promise<Result<ExportRowPage<Row>, DatabaseUnavailable>>;

/** Follows `next` to the end two rows at a time, so every walk crosses a page boundary. */
export async function walk<Row>(pager: Pager<Row>, scope: ExportScope): Promise<Row[]> {
  const rows: Row[] = [];
  let after: string | null = null;
  do {
    const page: ExportRowPage<Row> = expectOk(await pager(scope, after, 2));
    rows.push(...page.rows);
    after = page.next;
  } while (after !== null);
  return rows;
}
