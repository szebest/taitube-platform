import { PageHeader } from '@kit/components';
import { Button, Icon, useToast } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ManagedPostView } from '@vp/api-contracts';
import { useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import { LoadMore } from '#app/components/table/load-more';
import { managedPostsQueryOptions } from '#app/features/posts/api/post-queries';
import { useDeletePost } from '#app/features/posts/hooks/use-post-mutations';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { pagedRows, tableStateOf } from '#app/utils/paged-rows';
import { DeletePostDialog } from '../delete-post-dialog/delete-post-dialog';
import { PostComposerDialog } from '../post-composer-dialog/post-composer-dialog';
import { PostStatsSheet } from '../post-stats-sheet/post-stats-sheet';
import { PostStatusFilter } from '../post-status-filter/post-status-filter';
import { PostsTable } from '../posts-table/posts-table';

type Open =
  | { kind: 'compose'; post?: ManagedPostView }
  | { kind: 'stats'; id: string }
  | { kind: 'delete'; id: string };

const NONE: readonly ManagedPostView[] = [];

/** The channel's posts in any stage: filter them, write a new one, edit, pin, read the figures, delete. */
export function PostsPage() {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const navigate = useNavigate({ from: '/posts' });
  const { status } = useSearch({ from: '/_authed/posts' });
  const { channelId } = useActiveChannel();
  const remove = useDeletePost();
  const [open, setOpen] = useState<Open>();
  const posts = useInfiniteQuery({
    ...managedPostsQueryOptions(useApi(), channelId, status),
    select: pagedRows,
  });

  const rows = posts.data ?? NONE;
  const postOf = (id: string) => rows.find((row) => row.id === id);
  const composing = open?.kind === 'compose' ? open : undefined;
  const editing = composing?.post && (postOf(composing.post.id) ?? composing.post);
  const statsFor = open?.kind === 'stats' ? postOf(open.id) : undefined;
  const close = () => setOpen(undefined);

  const confirmDelete = (id: string) =>
    remove.mutate(id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.postsDeleted', {}, '') }),
      onError: (error) => showFailure(tOr('studio.postsDeleteFailed', {}, ''), error),
    });

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.postsTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>{tOr('studio.postsDescription', {}, '')}</PageHeader.Description>
        <PageHeader.Actions>
          <PostStatusFilter
            value={status}
            onChange={(next) => void navigate({ search: { status: next } })}
          />
          <Button variant="solid" tone="accent" onClick={() => setOpen({ kind: 'compose' })}>
            <Icon name="plus" />
            {tOr('studio.postsNew', {}, '')}
          </Button>
        </PageHeader.Actions>
      </PageHeader.Root>
      <PostsTable
        rows={rows}
        state={tableStateOf(posts, rows.length)}
        fetching={posts.isFetching}
        onRetry={() => void posts.refetch()}
        actions={{
          onEdit: (post) => setOpen({ kind: 'compose', post }),
          onStats: ({ id }) => setOpen({ kind: 'stats', id }),
          onDelete: ({ id }) => setOpen({ kind: 'delete', id }),
        }}
      />
      <LoadMore
        hasNextPage={posts.hasNextPage}
        fetching={posts.isFetchingNextPage}
        onLoadMore={() => void posts.fetchNextPage()}
      />
      {composing && (
        <PostComposerDialog key={editing?.id ?? 'new'} post={editing} onClose={close} />
      )}
      {statsFor && <PostStatsSheet post={statsFor} onClose={close} />}
      {open?.kind === 'delete' && (
        <DeletePostDialog onConfirm={() => confirmDelete(open.id)} onClose={close} />
      )}
    </div>
  );
}
