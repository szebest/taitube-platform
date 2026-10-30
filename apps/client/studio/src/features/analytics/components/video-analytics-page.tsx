import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';

import { AnalyticsOverview } from './analytics-overview';
import { AnalyticsRangeSwitch } from './analytics-range-switch';
import { RetentionHeatmap } from './retention-heatmap';

const VIDEO_ANALYTICS_ID = '/_authed/videos/$videoId/analytics';
const VIDEO_ANALYTICS_PATH = '/videos/$videoId/analytics';

export function VideoAnalyticsPage() {
  const { tOr } = useT();
  const navigate = useNavigate({ from: VIDEO_ANALYTICS_PATH });
  const { videoId } = useParams({ from: VIDEO_ANALYTICS_ID });
  const { range } = useSearch({ from: VIDEO_ANALYTICS_ID });

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.videoAnalyticsTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Actions>
          <AnalyticsRangeSwitch
            value={range}
            onChange={(next) => void navigate({ search: { range: next } })}
          />
        </PageHeader.Actions>
      </PageHeader.Root>
      <AnalyticsOverview scope={{ kind: 'video', videoId }} range={range} />
      <RetentionHeatmap videoId={videoId} />
    </div>
  );
}
