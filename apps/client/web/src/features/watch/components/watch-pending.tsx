import { Skeleton } from '@vp/ui';

import { CommentThreadSkeleton } from '#app/components/watch/comment-thread';
import { EngagementBarSkeleton } from '#app/components/watch/engagement-bar';
import { LinerNotesSkeleton } from '#app/components/watch/liner-notes';
import { QueueSkeleton } from '#app/components/watch/queue/queue-skeleton';
import { StageSkeleton } from '#app/components/watch/stage';

import { WatchLayout } from './watch-layout';

/** The watch page before its video arrives, at the size the loaded page has. */
export function WatchPending() {
  return (
    <WatchLayout
      stage={<StageSkeleton />}
      details={
        <>
          <Skeleton radius="xs" className="h-[2rem] w-3/5" />
          <EngagementBarSkeleton />
          <LinerNotesSkeleton />
        </>
      }
      discussion={<CommentThreadSkeleton />}
      aside={
        <>
          <Skeleton radius="chip" className="h-control-md w-[7rem] medium:hidden" />
          <div className="hidden medium:block">
            <QueueSkeleton />
          </div>
        </>
      }
    />
  );
}
