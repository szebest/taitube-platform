import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Badge, Spinner } from '@vp/ui';
import { authorCommentsQueryOptions } from '#app/features/comments/api/author-queries';
import type { InboxComment } from '#app/features/comments/api/inbox-queries';
import { WEB_URL } from '#app/lib/config';

export interface QueueDetailProps {
  comment: InboxComment;
}

function AuthorHistory({ comment }: QueueDetailProps) {
  const { tOr } = useT();
  const history = useQuery(authorCommentsQueryOptions(useApi(), comment.author.userId));
  const others = (history.data ?? []).filter(({ id }) => id !== comment.id);

  return (
    <section aria-labelledby="queue-history" className="flex flex-col gap-inline">
      <h2 id="queue-history" className="m-0 text-label">
        {tOr('studio.queueHistoryTitle', {}, '')}
      </h2>
      {history.isPending && <Spinner />}
      {history.isError && (
        <p role="alert" className="m-0 text-body-sm text-fg-muted">
          {tOr('studio.queueHistoryFailed', {}, '')}
        </p>
      )}
      {history.isSuccess && others.length === 0 && (
        <p className="m-0 text-body-sm text-fg-muted">{tOr('studio.queueHistoryEmpty', {}, '')}</p>
      )}
      {others.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-inline p-0">
          {others.map((other) => (
            <li key={other.id} className="flex items-start gap-inline">
              <Badge size="sm" tone={other.status === 'published' ? 'neutral' : 'warning'}>
                {tOr('studio.queueState', { state: other.status }, '')}
              </Badge>
              <span className="line-clamp-2 text-body-sm">{other.content}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One held comment with where it sits, why it was held and what its author wrote before. */
export function QueueDetail({ comment }: QueueDetailProps) {
  const { tOr } = useT();
  const author = comment.author.displayName ?? comment.author.handle ?? '';

  return (
    <article aria-label={author} className="flex flex-col gap-stack">
      <header className="flex flex-wrap items-center gap-inline">
        <h2 className="m-0 text-title">{author}</h2>
        <Badge tone="warning">
          {tOr(
            'studio.queueHeldReason',
            { reason: comment.moderation?.heldReason ?? 'unknown' },
            ''
          )}
        </Badge>
      </header>
      <p className="m-0 text-body-sm text-fg-muted">
        <a href={`${WEB_URL}/watch/${comment.video.id}`}>
          {tOr('studio.queueOnVideo', { title: comment.video.title }, '')}
        </a>
        {comment.parentId !== null && <> · {tOr('studio.queueInThread', {}, '')}</>}
      </p>
      <p className="m-0 whitespace-pre-line text-body">{comment.content}</p>
      <AuthorHistory comment={comment} />
    </article>
  );
}
