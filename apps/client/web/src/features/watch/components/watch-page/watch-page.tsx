import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useOpenInPlaybackSession } from '#app/features/watch/hooks/use-open-in-playback-session';
import { WatchCommentThread } from '../watch-comment-thread/watch-comment-thread';
import { WatchEngagementBar } from '../watch-engagement-bar/watch-engagement-bar';
import { WatchLayout } from '../watch-layout/watch-layout';
import { WatchLinerNotes } from '../watch-liner-notes/watch-liner-notes';
import { WatchQueue } from '../watch-queue/watch-queue';
import { WatchStage } from '../watch-stage/watch-stage';
import { WatchTranscript } from '../watch-transcript/watch-transcript';

/** `/watch/$videoId`: the stage, the title, the engagement bar, the notes and the discussion beside the queue. */
export function WatchPage() {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const { t, list } = useSearch({ from: '/watch/$videoId' });
  const autoplay = useLocation({ select: ({ state }) => state.autoplay === true });
  const api = useApi();
  const { tOr } = useT();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));

  useOpenInPlaybackSession({ video, list, startTime: t, autoplay });

  return (
    <WatchLayout
      stage={<WatchStage video={video} />}
      details={
        <>
          <h1 className="m-0 text-title-lg large:text-headline">
            {video.title ?? tOr('browse.untitled', {}, '')}
          </h1>
          <WatchEngagementBar video={video} />
          <WatchLinerNotes video={video} />
        </>
      }
      discussion={<WatchCommentThread videoId={video.id} />}
      aside={
        <>
          <WatchTranscript videoId={video.id} />
          <WatchQueue key={video.id} />
        </>
      }
    />
  );
}
