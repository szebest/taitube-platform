import { useInfiniteQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { EmptyState, SectionError } from '@vp/components';
import type { CreatorInboxFilter } from '@vp/domain';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { pagedRows, tableStateOf } from '#app/features/admin/api/paged-rows';
import { LoadMore } from '#app/features/admin/components/load-more/load-more';
import { type InboxComment, inboxQueryOptions } from '#app/features/comments/api/inbox-queries';
import { WEB_URL } from '#app/lib/config';
import { InboxCommentActions } from '../inbox-comment-actions/inbox-comment-actions';
import { InboxReply } from '../inbox-reply/inbox-reply';

const column = createColumnHelper<DataTableFeatures, InboxComment>();

const authorOf = ({ author }: InboxComment) => author.displayName ?? author.handle ?? '';

export interface CommentInboxProps {
  filter: CreatorInboxFilter;
}

/** The comments on the creator's videos under one filter, on the studio's `DataTable`, each answered in its row. */
export function CommentInbox({ filter }: CommentInboxProps) {
  const { tOr } = useT();
  const comments = useInfiniteQuery({
    ...inboxQueryOptions(useApi(), filter),
    select: pagedRows,
  });
  const [replyingTo, setReplyingTo] = useState<string>();

  const rows = comments.data ?? [];
  const state = tableStateOf(comments, rows.length);

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor((comment) => comment.video.title, {
        id: 'video',
        header: tOr('studio.commentsVideo', {}, ''),
        enableSorting: false,
        cell: ({ row: { original } }) => (
          <a href={`${WEB_URL}/watch/${original.video.id}`} className="line-clamp-2">
            {original.video.title}
          </a>
        ),
      }),
      column.accessor(authorOf, {
        id: 'author',
        header: tOr('studio.commentsAuthor', {}, ''),
        enableSorting: false,
      }),
      column.accessor('content', {
        header: tOr('studio.commentsComment', {}, ''),
        enableSorting: false,
        meta: { width: '40%' },
        cell: ({ row: { original } }) => (
          <>
            <span className="line-clamp-3 whitespace-pre-line">{original.content}</span>
            {replyingTo === original.id && (
              <InboxReply comment={original} onDone={() => setReplyingTo(undefined)} />
            )}
          </>
        ),
      }),
      column.accessor('createdAt', {
        header: tOr('studio.commentsPosted', {}, ''),
        enableSorting: false,
        cell: ({ row: { original } }) => (
          <time dateTime={original.createdAt}>
            <Format value={publishedAt(original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.commentsActions', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row: { original } }) => (
          <InboxCommentActions comment={original} onReply={() => setReplyingTo(original.id)} />
        ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <>
      <DataTable.Root
        table={table}
        state={state}
        fetching={comments.isFetching && !comments.isPending}
      >
        <DataTable.Caption>{tOr('studio.commentsCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.commentsEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.commentsEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => comments.refetch()} retrying={comments.isFetching}>
              <SectionError.Message>{tOr('studio.commentsFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={comments.hasNextPage}
        fetching={comments.isFetchingNextPage}
        onLoadMore={() => comments.fetchNextPage()}
      />
    </>
  );
}
