import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import type { CommentRemovalView } from '@vp/api-contracts';
import { EmptyState, PageHeader, PageHeaderSkeleton } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { myCommentRemovalsQueryOptions, ownRestrictionQueryOptions, useApi } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { Callout, Skeleton } from '@vp/ui';
import { PagedFooter } from '#app/components/feed/paged-footer';
import { usePagedItems } from '#app/features/library/hooks/use-paged-items';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';

function OwnBan({ channelId }: { channelId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const { data: ban } = useQuery(ownRestrictionQueryOptions(api, channelId));
  const { data: channel } = useQuery(channelQueryOptions(api, channelId));

  if (!(ban && channel)) {
    return null;
  }
  const until = ban.expiresAt
    ? tOr(
        'watch.commentsBannedUntil',
        {
          date: unwrapOr(
            format({ type: 'dateTime', value: ban.expiresAt, options: { style: 'medium' } }),
            ban.expiresAt
          ),
        },
        ''
      )
    : tOr('watch.commentsBannedForever', {}, '');

  return (
    <Callout.Root tone="warning" role="status">
      <Callout.Icon />
      <Callout.Title>
        {tOr('library.moderationBanTitle', { channel: channel.displayName }, '')}
      </Callout.Title>
      <Callout.Body>
        {ban.reason && (
          <p className="m-0">{tOr('watch.commentsBannedReason', { reason: ban.reason }, '')}</p>
        )}
        <p className="m-0">{until}</p>
      </Callout.Body>
    </Callout.Root>
  );
}

function RemovedComment({ removal }: { removal: CommentRemovalView }) {
  const { tOr } = useT();
  const { format } = useFormat();
  const when = unwrapOr(format(publishedAt(removal.createdAt).relative), '');

  return (
    <li className="flex flex-col gap-1">
      <p className="m-0 whitespace-pre-wrap break-words">{removal.excerpt}</p>
      <p className="m-0 text-body-sm text-fg-muted">
        {tOr(
          'library.moderationReasonLine',
          { reason: tOr('watch.moderationReason', { reason: removal.reason }, '') },
          ''
        )}
      </p>
      {removal.note && (
        <p className="m-0 text-body-sm text-fg-muted">
          {tOr('library.moderationNoteLine', { note: removal.note }, '')}
        </p>
      )}
      <p className="m-0 text-body-sm text-fg-muted">
        <time dateTime={removal.createdAt}>{tOr('library.moderationRemovedAt', { when }, '')}</time>
        {' · '}
        <Link to="/watch/$videoId" params={{ videoId: removal.videoId }}>
          {tOr('library.moderationOpenVideo', {}, '')}
        </Link>
      </p>
    </li>
  );
}

/** `/feed/you/moderation`: the viewer's comments a moderator removed and told them about, and a ban on the channel the notification came from. */
export function ModerationPage() {
  const api = useApi();
  const { tOr } = useT();
  const { channel } = useSearch({ from: '/_authed/feed/you_/moderation' });
  const { items, hasMore, isFetching, isError, loadMore } = usePagedItems(
    myCommentRemovalsQueryOptions(api)
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('library.moderationTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Description>
          {tOr('library.moderationDescription', {}, '')}
        </PageHeader.Description>
      </PageHeader.Root>
      {channel && <OwnBan channelId={channel} />}
      <section aria-labelledby="removed-comments" className="flex flex-col gap-4">
        <h2 id="removed-comments" className="m-0 text-title-lg">
          {tOr('library.moderationRemovedTitle', {}, '')}
        </h2>
        {items.length === 0 && !hasMore ? (
          <EmptyState.Root size="section" role="status">
            <EmptyState.Title>{tOr('library.moderationRemovedEmpty', {}, '')}</EmptyState.Title>
          </EmptyState.Root>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {items.map((removal) => (
              <RemovedComment key={removal.id} removal={removal} />
            ))}
          </ul>
        )}
        <PagedFooter
          hasMore={hasMore}
          isFetching={isFetching}
          isError={isError}
          onLoadMore={loadMore}
        />
      </section>
    </div>
  );
}

export function ModerationPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
