import { Link } from '@tanstack/react-router';
import type { AuthoredCommentView } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Icon, IconButton } from '@vp/ui';

import { myCommentsQueryOptions } from '../api/library-queries';
import { useDeleteMyComment } from '../hooks/use-delete-my-comment';
import { usePagedItems } from '../hooks/use-paged-items';
import { LibraryEmpty } from './library-empty';
import { PagedFooter } from './paged-footer';

function MyComment({ comment }: { comment: AuthoredCommentView }) {
  const { tOr } = useT();
  const { mutate } = useDeleteMyComment(comment.id);
  const { content, createdAt, video } = comment;

  return (
    <li className="tw:flex tw:items-start tw:gap-3">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
        <Link
          to="/watch/$videoId"
          params={{ videoId: video.id }}
          className="tw:text-body-sm tw:text-fg-muted"
        >
          {tOr('library.commentOn', { title: video.title }, '')}
        </Link>
        <p className="tw:m-0 tw:whitespace-pre-wrap tw:break-words">{content}</p>
        <time dateTime={createdAt} className="tw:text-body-sm tw:text-fg-muted">
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
    <div className="tw:flex tw:flex-col tw:gap-4">
      {items.length === 0 && !hasMore && <LibraryEmpty tab="comments" />}
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-5 tw:p-0">
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
