import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';

import { AnalyticsOverview } from './analytics-overview';
import { AnalyticsRangeSwitch } from './analytics-range-switch';

const ANALYTICS_ID = '/_authed/analytics';
const ANALYTICS_PATH = '/analytics';

export function AnalyticsPage() {
  const { tOr } = useT();
  const navigate = useNavigate({ from: ANALYTICS_PATH });
  const { range } = useSearch({ from: ANALYTICS_ID });

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.analyticsTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Actions>
          <AnalyticsRangeSwitch
            value={range}
            onChange={(next) => void navigate({ search: { range: next } })}
          />
        </PageHeader.Actions>
      </PageHeader.Root>
      <AnalyticsOverview scope={{ kind: 'channel' }} range={range} />
    </div>
  );
}
