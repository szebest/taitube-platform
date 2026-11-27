import { Tabs } from '@kit/ui';
import { useSearch } from '@tanstack/react-router';
import { Suspense } from 'react';
import { usePlayerSeek } from '#app/components/player/taitube-player';
import {
  DISCUSSION_TABS,
  type DiscussionTab,
  useThreadSearch,
} from '#app/features/watch/hooks/use-thread-search';
import { useT } from '#app/lib/messages';
import { StartThreadAction } from '../start-thread-action/start-thread-action';
import { WatchCommentThread } from '../watch-comment-thread/watch-comment-thread';
import { WatchThreadList } from '../watch-thread-list/watch-thread-list';
import { LazyWatchThreadPanel } from '../watch-thread-panel/watch-thread-panel.lazy';

const isTab = (value: string): value is DiscussionTab =>
  (DISCUSSION_TABS as readonly string[]).includes(value);

export interface WatchDiscussionProps {
  videoId: string;
}

/** The discussion area: Comments and Threads as tabs, both in the URL, and the panel of the thread the URL names. */
export function WatchDiscussion({ videoId }: WatchDiscussionProps) {
  const { tab = 'comments', thread } = useSearch({ from: '/watch/$videoId' });
  const { tOr } = useT();
  const { seek } = usePlayerSeek();
  const { setTab, close } = useThreadSearch(videoId);

  return (
    <>
      <Tabs.Root value={tab} onValueChange={(next) => isTab(next) && setTab(next)}>
        <Tabs.List aria-label={tOr('threads.tabsLabel', {}, '')}>
          {DISCUSSION_TABS.map((value) => (
            <Tabs.Tab key={value} value={value}>
              {tOr('threads.tab', { tab: value }, '')}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="comments" className="flex flex-col gap-stack pt-stack">
          <StartThreadAction videoId={videoId} variant="link" />
          <WatchCommentThread videoId={videoId} />
        </Tabs.Panel>
        <Tabs.Panel value="threads" className="pt-stack">
          <WatchThreadList videoId={videoId} />
        </Tabs.Panel>
      </Tabs.Root>
      {thread && (
        <Suspense>
          <LazyWatchThreadPanel threadId={thread} onSeek={seek} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
