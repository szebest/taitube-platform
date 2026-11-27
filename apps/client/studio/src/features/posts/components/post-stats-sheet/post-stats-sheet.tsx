import { SectionError, StatCard } from '@kit/components';
import { Format } from '@kit/intl-react';
import { Progress, ResponsiveModal, Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import type { ManagedPostView, PostStatsView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { postStatsQueryOptions } from '#app/features/posts/api/post-queries';
import { postExcerpt } from '#app/features/posts/utils/post-excerpt';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';

export interface PostStatsSheetProps {
  post: ManagedPostView;
  onClose: () => void;
}

const FIGURES = ['opens', 'shareClicks', 'likes', 'replies'] as const;

const count = (value: number) => ({ type: 'number', value }) as const;

function Votes({ post, stats }: { post: ManagedPostView; stats: PostStatsView }) {
  const { tOr } = useT();
  const { body } = post;
  const options = body.kind === 'poll' || body.kind === 'quiz' ? body.options : [];
  const total = stats.votesByOption.reduce((sum, votes) => sum + votes, 0);

  if (options.length === 0) return null;
  return (
    <section className="flex flex-col gap-stack" aria-labelledby="post-votes">
      <h3 id="post-votes" className="m-0 text-label">
        {tOr('studio.statsVotes', {}, '')}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-stack p-0">
        {options.map(({ text }, index) => {
          const votes = stats.votesByOption[index] ?? 0;

          return (
            <li key={text} className="flex flex-col gap-inline">
              <span className="flex justify-between gap-stack text-body-sm">
                <span className="min-w-0 truncate">{text}</span>
                <span className="text-fg-muted tabular-nums">
                  {tOr('studio.statsOptionVotes', { count: votes }, '')}
                </span>
              </span>
              <Progress aria-label={text} value={total === 0 ? 0 : (votes / total) * 100} />
            </li>
          );
        })}
      </ul>
      {body.kind === 'quiz' && (
        <p className="m-0 text-body-sm">
          {stats.quizCorrectShare === null ? (
            tOr('studio.statsQuizNone', {}, '')
          ) : (
            <>
              {tOr('studio.statsQuizShare', {}, '')}{' '}
              <Format value={{ type: 'percent', value: stats.quizCorrectShare * 100 }} />
            </>
          )}
        </p>
      )}
    </section>
  );
}

/** The figures of one published post, the votes under each option and a quiz's share of right answers. */
export function PostStatsSheet({ post, onClose }: PostStatsSheetProps) {
  const { tOr } = useT();
  const { channelId } = useActiveChannel();
  const stats = useQuery(postStatsQueryOptions(useApi(), channelId, post.id));

  return (
    <ResponsiveModal.Root open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModal.Content size="md">
        <ResponsiveModal.Header>
          <ResponsiveModal.Title>{tOr('studio.statsTitle', {}, '')}</ResponsiveModal.Title>
          <ResponsiveModal.Description className="line-clamp-2">
            {postExcerpt(post.body)}
          </ResponsiveModal.Description>
        </ResponsiveModal.Header>
        <ResponsiveModal.Body className="flex flex-col gap-section">
          {stats.isPending && <Skeleton className="h-32 w-full" />}
          {stats.isError && (
            <SectionError.Root
              role="alert"
              onRetry={() => void stats.refetch()}
              retrying={stats.isFetching}
            >
              <SectionError.Message>{tOr('studio.statsFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
          {stats.data && (
            <>
              <div className="grid grid-cols-2 gap-stack">
                {FIGURES.map((figure) => (
                  <StatCard.Root key={figure}>
                    <StatCard.Label>
                      {tOr('studio.statsFigure', { metric: figure }, '')}
                    </StatCard.Label>
                    <StatCard.Value>
                      <Format value={count(stats.data[figure])} />
                    </StatCard.Value>
                  </StatCard.Root>
                ))}
              </div>
              <Votes post={post} stats={stats.data} />
            </>
          )}
        </ResponsiveModal.Body>
      </ResponsiveModal.Content>
    </ResponsiveModal.Root>
  );
}
