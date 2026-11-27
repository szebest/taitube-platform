import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from '@tanstack/react-router';
import type { Video } from '@vp/api-contracts';
import { useApi, videoQueryOptions } from '@vp/queries';
import type { ReactNode } from 'react';
import { useOpenInPlaybackSession } from '#app/features/watch/hooks/use-open-in-playback-session';
import { useViewerReread } from '#app/features/watch/hooks/use-viewer-reread';
import { useT } from '#app/lib/messages';
import { ShareTokenContext } from '#app/lib/video-access/share-token.context';
import { WatchCorrections } from '../watch-corrections/watch-corrections';
import { WatchDiscussion } from '../watch-discussion/watch-discussion';
import { WatchEngagementBar } from '../watch-engagement-bar/watch-engagement-bar';
import { WatchLayout } from '../watch-layout/watch-layout';
import { WatchLinerNotes } from '../watch-liner-notes/watch-liner-notes';
import { WatchQueue } from '../watch-queue/watch-queue';
import { WatchStage } from '../watch-stage/watch-stage';
import { WatchTranscript } from '../watch-transcript/watch-transcript';

/** `/watch/$videoId`: the stage, the title, the engagement bar, the notes and the discussion beside the queue. */
export interface WatchPageProps {
  /** The loader read the video during the server render, without the tab's viewer key. */
  readOnServer: boolean;
  /** More engagement actions for the loaded video, from the features the route composes in. */
  renderActions?: (video: Video) => ReactNode;
  /** What the loaded video's team sees between the engagement bar and the description, from the feature the route composes in. */
  renderCreatorStats?: (video: Video) => ReactNode;
}

export function WatchPage({ readOnServer, renderActions, renderCreatorStats }: WatchPageProps) {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const { t, list, s } = useSearch({ from: '/watch/$videoId' });
  const autoplay = useLocation({ select: ({ state }) => state.autoplay === true });
  const api = useApi();
  const { tOr } = useT();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId, s));

  useOpenInPlaybackSession({ video, list, startTime: t, autoplay, shareToken: s });
  useViewerReread(videoId, readOnServer);

  return (
    <ShareTokenContext value={s}>
      <WatchLayout
        stage={<WatchStage video={video} />}
        details={
          <>
            <h1 className="m-0 text-title-lg large:text-headline">
              {video.title ?? tOr('browse.untitled', {}, '')}
            </h1>
            <WatchEngagementBar video={video} renderActions={renderActions} />
            {renderCreatorStats?.(video)}
            <WatchLinerNotes video={video} />
            <WatchCorrections videoId={video.id} />
          </>
        }
        discussion={<WatchDiscussion videoId={video.id} />}
        aside={
          <>
            <WatchTranscript videoId={video.id} />
            <WatchQueue key={video.id} video={video} />
          </>
        }
      />
    </ShareTokenContext>
  );
}
