import { Skeleton } from '@vp/ui';

import { CommentThreadSkeleton } from '#app/components/watch/comment-thread';
import { EngagementBarSkeleton } from '#app/components/watch/engagement-bar';
import { LinerNotesSkeleton } from '#app/components/watch/liner-notes';
import { QueueSkeleton } from '#app/components/watch/queue';
import { StageSkeleton } from '#app/components/watch/stage';

import { WatchLayout } from './watch-layout';

/** The watch page before its video arrives, at the size the loaded page has. */
export function WatchPending() {
  return (
    <WatchLayout
      stage={<StageSkeleton />}
      details={
        <>
          <Skeleton radius="xs" className="tw:h-[2rem] tw:w-3/5" />
          <EngagementBarSkeleton />
          <LinerNotesSkeleton />
        </>
      }
      discussion={<CommentThreadSkeleton />}
      aside={
        <div className="tw:hidden tw:medium:block">
          <QueueSkeleton />
        </div>
      }
    />
  );
}
