import { Skeleton } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { threadQueryOptions, useApi, usePostViewer } from '@vp/queries';
import { ThreadPanel } from '#app/components/watch/thread-panel';
import { useTimeLabel } from '#app/features/watch/hooks/use-time-label';
import { useT } from '#app/lib/messages';
import { ThreadReplies } from '../thread-replies/thread-replies';

export interface WatchThreadPanelProps {
  threadId: string;
  /** Moves the player to the thread's moment. */
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

const MS_PER_SECOND = 1000;

/** The thread named in the URL, in a panel beside the video: its moment, its text and its replies. */
export function WatchThreadPanel({ threadId, onSeek, onClose }: WatchThreadPanelProps) {
  const api = useApi();
  const { tOr } = useT();
  const timeLabel = useTimeLabel();
  const { data: thread, isError } = useQuery(threadQueryOptions(api, threadId, usePostViewer()));

  return (
    <ThreadPanel.Root open onOpenChange={(open) => !open && onClose()} onSeek={onSeek}>
      <ThreadPanel.Header>
        <ThreadPanel.Title>{thread?.title ?? tOr('threads.openThread', {}, '')}</ThreadPanel.Title>
        {thread && (
          <ThreadPanel.Anchor
            seconds={thread.anchorMs / MS_PER_SECOND}
            time={timeLabel(thread.anchorMs)}
          />
        )}
      </ThreadPanel.Header>
      {isError && <p className="m-0 text-body">{tOr('threads.panelFailed', {}, '')}</p>}
      {!(thread || isError) && <Skeleton className="h-16 w-full" />}
      {thread && (
        <>
          {thread.body && <ThreadPanel.Body>{thread.body}</ThreadPanel.Body>}
          <ThreadPanel.Replies>
            <ThreadReplies threadId={thread.id} />
          </ThreadPanel.Replies>
        </>
      )}
    </ThreadPanel.Root>
  );
}
