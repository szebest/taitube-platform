import type { LiveStreamView } from '@vp/api-contracts';
import { Format, useT } from '@vp/intl-react';
import { StatCard } from '#app/components/analytics/stat-card';
import { useNow } from '../hooks/use-now';

const MS_PER_SECOND = 1000;

export interface LiveStatsProps {
  stream: LiveStreamView;
  /** The viewers heard on the video's event stream; `null` until one is. */
  viewers: number | null;
}

/** The three figures of the broadcast: viewers now, time live and the chat mode. */
export function LiveStats({ stream, viewers }: LiveStatsProps) {
  const { tOr } = useT();
  const live = stream.status === 'LIVE';
  const now = useNow(live);
  const elapsed =
    live && stream.startedAt !== null && now !== undefined
      ? Math.max(0, (now - Date.parse(stream.startedAt)) / MS_PER_SECOND)
      : null;
  const { slowModeSeconds, subscribersOnly } = stream.chat;

  return (
    <div className="grid grid-cols-1 gap-stack medium:grid-cols-3">
      <StatCard.Root state={viewers === null ? 'empty' : 'ready'}>
        <StatCard.Label>{tOr('studio.liveViewersLabel', {}, '')}</StatCard.Label>
        <StatCard.Value>
          <Format value={{ type: 'count', value: viewers ?? 0 }} />
        </StatCard.Value>
      </StatCard.Root>
      <StatCard.Root state={elapsed === null ? 'empty' : 'ready'}>
        <StatCard.Label>{tOr('studio.liveTimeLabel', {}, '')}</StatCard.Label>
        <StatCard.Value>
          <Format value={{ type: 'duration', value: elapsed ?? 0 }} />
        </StatCard.Value>
      </StatCard.Root>
      <StatCard.Root>
        <StatCard.Label>{tOr('studio.liveChatModeLabel', {}, '')}</StatCard.Label>
        <StatCard.Value>
          {tOr(
            'studio.liveChatAudience',
            { audience: subscribersOnly ? 'subscribers' : 'everyone' },
            ''
          )}
        </StatCard.Value>
        <p className="m-0 text-caption text-fg-muted">
          {slowModeSeconds === 0
            ? tOr('studio.liveSlowModeOff', {}, '')
            : tOr('studio.liveSlowModeOn', { seconds: slowModeSeconds }, '')}
        </p>
      </StatCard.Root>
    </div>
  );
}
