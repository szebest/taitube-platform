import { createColumnHelper, useTable } from '@tanstack/react-table';
import { EmptyState, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canManageCategory } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { Button, Icon, IconButton, Switch, useToast } from '@vp/ui';
import { useState } from 'react';

import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import type { AdminCategory } from '#app/features/admin/api/admin-categories';
import { useAdminCategories } from '#app/features/admin/hooks/use-admin-categories';
import { useUpdateCategory } from '#app/features/admin/hooks/use-category-mutations';
import { CategoryDeleteDialog } from './category-delete-dialog';
import { CategoryDialog } from './category-dialog';
import { CategoryReorderDialog } from './category-reorder-dialog';

const column = createColumnHelper<DataTableFeatures, AdminCategory>();
const NONE: readonly AdminCategory[] = [];

type Open =
  | { kind: 'create' }
  | { kind: 'edit'; category: AdminCategory }
  | { kind: 'delete'; category: AdminCategory }
  | { kind: 'reorder' };

/** Every category, active and inactive, on the studio's `DataTable`, with what an admin may do to each. */
export function CategoryTable() {
  const { tOr } = useT();
  const toast = useToast();
  const canManage = useCan(canManageCategory);
  const categories = useAdminCategories();
  const update = useUpdateCategory();
  const [open, setOpen] = useState<Open>();

  const data = categories.data ?? NONE;
  const close = () => setOpen(undefined);
  const nextSortOrder = Math.max(-1, ...data.map(({ sortOrder }) => sortOrder)) + 1;

  const toggle = (category: AdminCategory, isActive: boolean) =>
    update.mutate(
      { id: category.id, changes: { isActive } },
      {
        onError: () =>
          toast({ tone: 'danger', title: tOr('studio.adminCategorySaveFailed', {}, '') }),
      }
    );

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('sortOrder', {
        header: tOr('studio.adminCategoryOrder', {}, ''),
        meta: { numeric: true, width: '6rem' },
      }),
      column.accessor('name', { header: tOr('studio.adminCategoryName', {}, '') }),
      column.accessor('slug', { header: tOr('studio.adminCategorySlug', {}, '') }),
      column.accessor('videoCount', {
        header: tOr('studio.adminCategoryVideos', {}, ''),
        meta: { numeric: true, width: '7rem' },
      }),
      column.accessor('isActive', {
        header: tOr('studio.adminCategoryActive', {}, ''),
        meta: { width: '7rem' },
        cell: ({ row }) => (
          <Switch
            size="sm"
            checked={row.original.isActive}
            disabled={!canManage}
            aria-label={tOr('studio.adminCategoryToggle', { name: row.original.name }, '')}
            onCheckedChange={(isActive) => toggle(row.original, isActive)}
          />
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.adminCategoryActions', {}, ''),
        enableSorting: false,
        meta: { width: '8rem' },
        cell: ({ row }) =>
          canManage && (
            <span className="tw:flex tw:gap-inline">
              <IconButton
                size="sm"
                aria-label={tOr('studio.adminCategoryEdit', { name: row.original.name }, '')}
                onClick={() => setOpen({ kind: 'edit', category: row.original })}
              >
                <Icon name="edit" />
              </IconButton>
              <IconButton
                size="sm"
                aria-label={tOr('studio.adminCategoryDelete', { name: row.original.name }, '')}
                onClick={() => setOpen({ kind: 'delete', category: row.original })}
              >
                <Icon name="trash" />
              </IconButton>
            </span>
          ),
      }),
    ]),
    data,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    manualPagination: true,
    initialState: { sorting: [{ id: 'sortOrder', desc: false }] },
  });

  const state = (() => {
    if (categories.isPending) {
      return 'loading';
    }
    if (categories.isError) {
      return 'error';
    }
    return data.length === 0 ? 'empty' : 'ready';
  })();

  return (
    <>
      <DataTable.Root
        table={table}
        state={state}
        fetching={categories.isFetching && !categories.isPending}
      >
        <DataTable.Caption>{tOr('studio.adminCategoriesCaption', {}, '')}</DataTable.Caption>
        {canManage && (
          <DataTable.Toolbar>
            <Button
              variant="solid"
              tone="accent"
              size="sm"
              onClick={() => setOpen({ kind: 'create' })}
            >
              <Icon name="plus" />
              {tOr('studio.adminCategoryNew', {}, '')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.length < 2}
              onClick={() => setOpen({ kind: 'reorder' })}
            >
              <Icon name="sort" />
              {tOr('studio.adminCategoryReorder', {}, '')}
            </Button>
          </DataTable.Toolbar>
        )}
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.adminCategoriesEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.adminCategoriesEmptyDescription', {}, '')}
              </EmptyState.Description>
              {canManage && (
                <EmptyState.Action onClick={() => setOpen({ kind: 'create' })}>
                  {tOr('studio.adminCategoryNew', {}, '')}
                </EmptyState.Action>
              )}
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root
              onRetry={() => categories.refetch()}
              retrying={categories.isFetching}
            >
              <SectionError.Message>
                {tOr('studio.adminCategoriesFailed', {}, '')}
              </SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      {open?.kind === 'create' && <CategoryDialog nextSortOrder={nextSortOrder} onClose={close} />}
      {open?.kind === 'edit' && (
        <CategoryDialog category={open.category} nextSortOrder={nextSortOrder} onClose={close} />
      )}
      {open?.kind === 'delete' && <CategoryDeleteDialog category={open.category} onClose={close} />}
      {open?.kind === 'reorder' && (
        <CategoryReorderDialog
          categories={[...data].sort((a, b) => a.sortOrder - b.sortOrder)}
          onClose={close}
        />
      )}
    </>
  );
}
