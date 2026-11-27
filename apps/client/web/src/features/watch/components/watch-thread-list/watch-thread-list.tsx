import { EmptyState } from '@kit/components';
import { Badge } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SectionBoundary, useApi, usePostViewer, videoThreadsQueryOptions } from '@vp/queries';
import { Suspense } from 'react';
import { useThreadSearch } from '#app/features/watch/hooks/use-thread-search';
import { useTimeLabel } from '#app/features/watch/hooks/use-time-label';
import { useT } from '#app/lib/messages';
import { StartThreadAction } from '../start-thread-action/start-thread-action';

function Threads({ videoId }: { videoId: string }) {
  const api = useApi();
  const { tOr } = useT();
  const timeLabel = useTimeLabel();
  const { open } = useThreadSearch(videoId);
  const { data } = useSuspenseQuery(videoThreadsQueryOptions(api, videoId, usePostViewer()));

  return (
    <div className="flex flex-col gap-stack">
      <StartThreadAction videoId={videoId} variant="link" />
      {data.items.length === 0 ? (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('threads.listEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-inline p-0">
          {data.items.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-card border-0 bg-transparent p-inline text-start text-fg hover:bg-accent-soft focus-ring"
                onClick={() => open(thread.id)}
              >
                <span className="flex flex-wrap items-center gap-inline text-label">
                  <span className="tabular-nums">
                    {tOr('threads.anchorAt', { time: timeLabel(thread.anchorMs) }, '')}
                  </span>
                  {thread.isPinned && <Badge>{tOr('threads.pinned', {}, '')}</Badge>}
                </span>
                <span className="text-title">{thread.title}</span>
                <span className="text-body-sm text-fg-muted">
                  {tOr('threads.replyCount', { count: thread.replyCount }, '')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface WatchThreadListProps {
  videoId: string;
}

/** The video's threads in the order the API gives them, each opening its panel; a failure stays in the section. */
export function WatchThreadList({ videoId }: WatchThreadListProps) {
  const { tOr } = useT();

  return (
    <SectionBoundary message={tOr('threads.listFailed', {}, '')} resetKey={videoId} layout="block">
      <Suspense>
        <Threads videoId={videoId} />
      </Suspense>
    </SectionBoundary>
  );
}
