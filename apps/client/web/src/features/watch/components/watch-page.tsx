import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';

import { PlayerChannelProvider } from '#app/features/player';

import { WatchCommentThread } from './watch-comment-thread';
import { WatchEngagementBar } from './watch-engagement-bar';
import { WatchLayout } from './watch-layout';
import { WatchLinerNotes } from './watch-liner-notes';
import { WatchQueue } from './watch-queue';
import { WatchStage } from './watch-stage';

/** `/watch/$videoId`: the stage, the title, the engagement bar, the notes and the discussion beside the queue. */
export function WatchPage() {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const { t } = useSearch({ from: '/watch/$videoId' });
  const api = useApi();
  const { tOr } = useT();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));

  return (
    <PlayerChannelProvider>
      <WatchLayout
        stage={<WatchStage video={video} startTime={t} />}
        details={
          <>
            <h1 className="tw:m-0 tw:text-title-lg tw:large:text-headline">
              {video.title ?? tOr('browse.untitled', {}, '')}
            </h1>
            <WatchEngagementBar video={video} />
            <WatchLinerNotes video={video} />
          </>
        }
        discussion={<WatchCommentThread videoId={video.id} />}
        aside={<WatchQueue key={video.id} />}
      />
    </PlayerChannelProvider>
  );
}
