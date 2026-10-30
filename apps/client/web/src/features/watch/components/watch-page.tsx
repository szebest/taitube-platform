import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';

import { PlayerChannelProvider } from '#app/features/player';

import { RelatedVideos } from './related-videos';
import { WatchCommentThread } from './watch-comment-thread';
import { WatchEngagementBar } from './watch-engagement-bar';
import { WatchLayout } from './watch-layout';
import { WatchLinerNotes } from './watch-liner-notes';
import { WatchStage } from './watch-stage';

/** `/watch/$videoId`: the stage, the title, the engagement bar and the notes beside the related videos. */
export function WatchPage() {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const { t } = useSearch({ from: '/watch/$videoId' });
  const api = useApi();
  const { tOr } = useT();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));

  return (
    <PlayerChannelProvider>
      <WatchLayout
        main={
          <>
            <WatchStage video={video} startTime={t} />
            <h1 className="tw:m-0 tw:text-title-lg tw:large:text-headline">
              {video.title ?? tOr('browse.untitled', {}, '')}
            </h1>
            <WatchEngagementBar video={video} />
            <WatchLinerNotes video={video} />
            <WatchCommentThread videoId={video.id} />
          </>
        }
        aside={<RelatedVideos videoId={video.id} />}
      />
    </PlayerChannelProvider>
  );
}
