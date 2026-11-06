import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveStreamView } from '@vp/api-contracts';
import { PageHeader, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi, useLiveVideoEvents } from '@vp/queries';
import { Badge, Button } from '@vp/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { WEB_URL } from '#app/config';
import { liveKeys, myLiveStreamQueryOptions } from '../api/live-queries';
import { LiveChatModeForm } from './live-chat-mode-form';
import { LiveChatModeration } from './live-chat-moderation';
import { LiveCredentialsCard } from './live-credentials-card';
import { LiveDashboardSkeleton } from './live-dashboard-skeleton';
import { LiveStats } from './live-stats';
import { LiveStopButton } from './live-stop-button';
import { LiveViewersChart } from './live-viewers-chart';

interface EndedBroadcast {
  streamId: string;
  videoId: string | null;
}

interface LiveEndedSummaryProps {
  videoId: string | null;
}

function LiveEndedSummary({ videoId }: LiveEndedSummaryProps) {
  const { tOr } = useT();

  return (
    <div className="flex flex-wrap items-center gap-stack">
      <p className="m-0 text-editorial text-fg-muted">{tOr('studio.liveEndedLine', {}, '')}</p>
      {videoId !== null && (
        <Button asChild variant="outline">
          <a href={`${WEB_URL}/watch/${videoId}`}>{tOr('studio.liveWatchRecording', {}, '')}</a>
        </Button>
      )}
    </div>
  );
}

interface LiveBroadcastProps {
  stream: LiveStreamView;
  onEnded: (ended: EndedBroadcast) => void;
}

function LiveBroadcast({ stream, onEnded }: LiveBroadcastProps) {
  const { tOr } = useT();
  const live = stream.status === 'LIVE';
  const queryClient = useQueryClient();
  const heard = useLiveVideoEvents(live ? stream.videoId : null);

  const handleEnded = useEffectEvent(() => {
    onEnded({ streamId: stream.id, videoId: stream.videoId });
    void queryClient.invalidateQueries({ queryKey: liveKeys.mine() });
  });

  useEffect(() => {
    if (heard.status === 'ENDED') {
      handleEnded();
    }
  }, [heard.status]);

  return (
    <div className="flex flex-col gap-section">
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
        <p className="m-0 text-editorial text-fg-muted">{tOr('studio.liveIdleLine', {}, '')}</p>
      )}
      {stream.status === 'ENDED' && <LiveEndedSummary videoId={stream.videoId} />}
      <LiveStats stream={stream} viewers={heard.viewers} />
      <LiveViewersChart samples={heard.samples} />
      <div className="grid items-start gap-stack large:grid-cols-2">
        {stream.ingest !== null && <LiveCredentialsCard ingest={stream.ingest} />}
        <div className="flex flex-col gap-stack">
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
  const [ended, setEnded] = useState<EndedBroadcast | null>(null);

  if (data) {
    const showEnded = ended !== null && data.status === 'IDLE' && data.id !== ended.streamId;

    return (
      <div className="flex flex-col gap-section">
        {showEnded && <LiveEndedSummary videoId={ended.videoId} />}
        <LiveBroadcast key={data.id} stream={data} onEnded={setEnded} />
      </div>
    );
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
