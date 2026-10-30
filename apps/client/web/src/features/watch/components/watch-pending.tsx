import { Skeleton } from '@vp/ui';

import { EngagementBarSkeleton } from '#app/components/watch/engagement-bar';
import { LinerNotesSkeleton } from '#app/components/watch/liner-notes';
import { StageSkeleton } from '#app/components/watch/stage';

import { WatchLayout } from './watch-layout';

/** The watch page before its video arrives, at the size the loaded page has. */
export function WatchPending() {
  return (
    <WatchLayout
      main={
        <>
          <StageSkeleton />
          <Skeleton radius="xs" className="tw:h-[2rem] tw:w-3/5" />
          <EngagementBarSkeleton />
          <LinerNotesSkeleton />
        </>
      }
    />
  );
}
