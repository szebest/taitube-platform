import { EmptyState, SectionError } from '@kit/components';
import { Format } from '@kit/intl-react';
import { Badge, Icon } from '@kit/ui';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { ManagedPostView } from '@vp/api-contracts';
import type { PostStatus } from '@vp/domain';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { postExcerpt } from '#app/features/posts/utils/post-excerpt';
import { useT } from '#app/lib/messages';
import type { tableStateOf } from '#app/utils/paged-rows';
import { PostRowMenu, type PostRowMenuProps } from '../post-row-menu/post-row-menu';

interface PostRowActions {
  onEdit: (post: ManagedPostView) => void;
  onStats: (post: ManagedPostView) => void;
  onDelete: (post: ManagedPostView) => void;
}

export interface PostsTableProps {
  rows: readonly ManagedPostView[];
  state: ReturnType<typeof tableStateOf>;
  fetching: boolean;
  onRetry: () => void;
  actions: PostRowActions;
}

const column = createColumnHelper<DataTableFeatures, ManagedPostView>();

const STATUS_TONE = {
  draft: 'neutral',
  scheduled: 'warning',
  published: 'success',
} as const satisfies Record<PostStatus, string>;

const WHEN = { draft: 'createdAt', scheduled: 'publishAt', published: 'publishedAt' } as const;

type MenuActions = Pick<PostRowMenuProps, 'onEdit' | 'onStats' | 'onDelete'>;

const menuFor = (post: ManagedPostView, actions: PostRowActions): MenuActions => ({
  onEdit: () => actions.onEdit(post),
  onStats: () => actions.onStats(post),
  onDelete: () => actions.onDelete(post),
});

/** The channel's posts, one row each: what it is, what it says, its stage, when, its replies and its menu. */
export function PostsTable({ rows, state, fetching, onRetry, actions }: PostsTableProps) {
  const { tOr } = useT();
  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.display({
        id: 'kind',
        header: tOr('studio.postsColumnKind', {}, ''),
        meta: { width: '7rem' },
        cell: ({ row: { original } }) => (
          <Badge size="sm" variant="soft">
            {tOr('studio.postsKind', { kind: original.kind }, '')}
          </Badge>
        ),
      }),
      column.display({
        id: 'post',
        header: tOr('studio.postsColumnPost', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex items-start gap-inline">
            {original.pinned && (
              <span title={tOr('studio.postsPinnedMarker', {}, '')}>
                <Icon name="pin" size="sm" aria-label={tOr('studio.postsPinnedMarker', {}, '')} />
              </span>
            )}
            <span className="line-clamp-2 whitespace-pre-line">
              {postExcerpt(original.body) || tOr('studio.postsNoText', {}, '')}
            </span>
          </span>
        ),
      }),
      column.display({
        id: 'status',
        header: tOr('studio.postsColumnStatus', {}, ''),
        meta: { width: '8rem' },
        cell: ({ row: { original } }) => (
          <Badge size="sm" tone={STATUS_TONE[original.status]}>
            {tOr('studio.postsStatus', { status: original.status }, '')}
          </Badge>
        ),
      }),
      column.display({
        id: 'when',
        header: tOr('studio.postsColumnWhen', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row: { original } }) => {
          const at = original[WHEN[original.status]];
          return at === null ? null : (
            <time dateTime={at}>
              <Format value={{ type: 'dateTime', value: at }} />
            </time>
          );
        },
      }),
      column.display({
        id: 'comments',
        header: tOr('studio.postsColumnComments', {}, ''),
        meta: { width: '8rem', numeric: true },
        cell: ({ row: { original } }) =>
          original.commentsEnabled ? (
            original.commentsCount
          ) : (
            <span className="text-fg-muted">{tOr('studio.postsCommentsOff', {}, '')}</span>
          ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.postsColumnActions', {}, ''),
        meta: { width: '6rem' },
        cell: ({ row: { original } }) => (
          <PostRowMenu post={original} {...menuFor(original, actions)} />
        ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    enableSorting: false,
    manualPagination: true,
  });

  return (
    <DataTable.Root table={table} state={state} fetching={fetching && state !== 'loading'}>
      <DataTable.Caption>{tOr('studio.postsCaption', {}, '')}</DataTable.Caption>
      <DataTable.Header />
      <DataTable.Body>
        {state === 'empty' && (
          <EmptyState.Root size="section">
            <EmptyState.Title>{tOr('studio.postsEmptyTitle', {}, '')}</EmptyState.Title>
            <EmptyState.Description>{tOr('studio.postsEmptyBody', {}, '')}</EmptyState.Description>
          </EmptyState.Root>
        )}
        {state === 'error' && (
          <SectionError.Root onRetry={onRetry} retrying={fetching}>
            <SectionError.Message>{tOr('studio.postsFailed', {}, '')}</SectionError.Message>
          </SectionError.Root>
        )}
      </DataTable.Body>
    </DataTable.Root>
  );
}
