import { Link } from '@tanstack/react-router';
import type { AuthoredCommentView } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Icon, IconButton } from '@vp/ui';
import { PagedFooter } from '#app/components/feed/paged-footer';
import { myCommentsQueryOptions } from '#app/features/library/api/library-queries';
import { useDeleteMyComment } from '#app/features/library/hooks/use-delete-my-comment';
import { usePagedItems } from '#app/features/library/hooks/use-paged-items';
import { LibraryEmpty } from '../library-empty/library-empty';

function MyComment({ comment }: { comment: AuthoredCommentView }) {
  const { tOr } = useT();
  const { mutate } = useDeleteMyComment(comment.id);
  const { content, createdAt, video } = comment;

  return (
    <li className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id }}
          className="text-body-sm text-fg-muted"
        >
          {tOr('library.commentOn', { title: video.title }, '')}
        </Link>
        <p className="m-0 whitespace-pre-wrap break-words">{content}</p>
        <time dateTime={createdAt} className="text-body-sm text-fg-muted">
          <Format value={publishedAt(createdAt).relative} />
        </time>
      </div>
      <IconButton aria-label={tOr('library.deleteComment', {}, '')} onClick={() => mutate()}>
        <Icon name="trash" />
      </IconButton>
    </li>
  );
}

/** The comments and replies the viewer wrote, newest first, each linked to its video, with Delete. */
export function CommentsList() {
  const api = useApi();
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    myCommentsQueryOptions(api)
  );

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="comments" />}
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {items.map((comment) => (
          <MyComment key={comment.id} comment={comment} />
        ))}
      </ul>
      <PagedFooter
        hasMore={hasMore}
        isFetching={isFetching}
        isError={isError}
        onLoadMore={loadMore}
      />
    </div>
  );
}
