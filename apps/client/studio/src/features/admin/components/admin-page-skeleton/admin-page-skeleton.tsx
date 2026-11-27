import { DataTableSkeleton } from '#app/components/table/data-table';

const COLUMNS = ['name', 'status', 'count', 'date', 'actions'].map(() => ({ meta: {} }));

/** An admin page before its rows have loaded: the table's frame and its rows. */
export function AdminPageSkeleton() {
  return (
    <div data-slot="admin-page-skeleton" className="min-w-0">
      <DataTableSkeleton columns={COLUMNS} selectable={false} />
    </div>
  );
}
