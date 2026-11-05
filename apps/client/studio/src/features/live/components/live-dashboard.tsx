import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveStreamView } from '@vp/api-contracts';
import { PageHeader, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi, useLiveVideoEvents } from '@vp/queries';
import { Badge, Button } from '@vp/ui';
import { useEffect } from 'react';

import { WEB_URL } from '#app/config';
import { liveKeys, myLiveStreamQueryOptions } from '../api/live-queries';
import { LiveChatModeForm } from './live-chat-mode-form';
import { LiveChatModeration } from './live-chat-moderation';
import { LiveCredentialsCard } from './live-credentials-card';
import { LiveDashboardSkeleton } from './live-dashboard-skeleton';
import { LiveStats } from './live-stats';
import { LiveStopButton } from './live-stop-button';
import { LiveViewersChart } from './live-viewers-chart';

interface LiveBroadcastProps {
  stream: LiveStreamView;
}

function LiveBroadcast({ stream }: LiveBroadcastProps) {
  const { tOr } = useT();
  const live = stream.status === 'LIVE';
  const queryClient = useQueryClient();
  const heard = useLiveVideoEvents(live ? stream.videoId : null);

  useEffect(() => {
    if (heard.status === 'ENDED') {
      void queryClient.invalidateQueries({ queryKey: liveKeys.mine() });
    }
  }, [heard.status, queryClient]);

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{stream.title === '' ? tOr('studio.liveUntitled', {}, '') : stream.title}</h1>
        </PageHeader.Title>
        <PageHeader.Actions>
          <Badge tone={live ? 'live' : 'neutral'} variant="soft">
            {tOr('studio.liveStatus', { status: stream.status }, '')}
          </Badge>
          {live && <LiveStopButton streamId={stream.id} />}
        </PageHeader.Actions>
      </PageHeader.Root>
      {stream.status === 'IDLE' && (
        <p className="tw:m-0 tw:text-editorial tw:text-fg-muted">
          {tOr('studio.liveIdleLine', {}, '')}
        </p>
      )}
      {stream.status === 'ENDED' && (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-stack">
          <p className="tw:m-0 tw:text-editorial tw:text-fg-muted">
            {tOr('studio.liveEndedLine', {}, '')}
          </p>
          {stream.videoId !== null && (
            <Button asChild variant="outline">
              <a href={`${WEB_URL}/watch/${stream.videoId}`}>
                {tOr('studio.liveWatchRecording', {}, '')}
              </a>
            </Button>
          )}
        </div>
      )}
      <LiveStats stream={stream} viewers={heard.viewers} />
      <LiveViewersChart samples={heard.samples} />
      <div className="tw:grid tw:items-start tw:gap-stack tw:large:grid-cols-2">
        {stream.ingest !== null && <LiveCredentialsCard ingest={stream.ingest} />}
        <div className="tw:flex tw:flex-col tw:gap-stack">
          <LiveChatModeration stream={stream} />
          <LiveChatModeForm
            key={`${stream.chat.slowModeSeconds}-${stream.chat.subscribersOnly}`}
            stream={stream}
          />
        </div>
      </div>
    </div>
  );
}

/** The creator's live page: the stream the API opened for the channel, in whichever state it is in. */
export function LiveDashboard() {
  const { tOr } = useT();
  const { data, isError, isFetching, refetch } = useQuery(myLiveStreamQueryOptions(useApi()));

  if (data) {
    return <LiveBroadcast key={data.id} stream={data} />;
  }

  if (isError) {
    return (
      <SectionError.Root layout="block" onRetry={() => void refetch()} retrying={isFetching}>
        <SectionError.Message>{tOr('studio.liveLoadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }

  return <LiveDashboardSkeleton />;
}
