import { PageHeader } from '@kit/components';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useT } from '#app/lib/messages';
import { AnalyticsOverview } from '../analytics-overview/analytics-overview';
import { AnalyticsRangeSwitch } from '../analytics-range-switch/analytics-range-switch';
import { BenchmarkChart } from '../benchmark-chart/benchmark-chart';
import { DeviceSplit } from '../device-split/device-split';
import { DropOffBadges } from '../drop-off-badges/drop-off-badges';
import { RetentionHeatmap } from '../retention-heatmap/retention-heatmap';

const VIDEO_ANALYTICS_ID = '/_authed/videos/$videoId/analytics';
const VIDEO_ANALYTICS_PATH = '/videos/$videoId/analytics';

export function VideoAnalyticsPage() {
  const { tOr } = useT();
  const navigate = useNavigate({ from: VIDEO_ANALYTICS_PATH });
  const { videoId } = useParams({ from: VIDEO_ANALYTICS_ID });
  const { range } = useSearch({ from: VIDEO_ANALYTICS_ID });

  return (
    <div className="flex flex-col gap-section">
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
      <div className="grid gap-section medium:grid-cols-2">
        <DeviceSplit videoId={videoId} range={range} />
        <BenchmarkChart videoId={videoId} />
      </div>
      <DropOffBadges videoId={videoId} />
      <RetentionHeatmap videoId={videoId} />
    </div>
  );
}
