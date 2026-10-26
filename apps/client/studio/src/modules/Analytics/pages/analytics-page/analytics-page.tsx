import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useApi, videoRetentionQueryOptions } from '@vp/queries';

import { RetentionChart } from '#app/features/analytics/components/retention-chart';

export function AnalyticsPage() {
  const { videoId } = useParams({ from: '/_authed/videos/$videoId/analytics' });
  const api = useApi();
  const {
    data: { curve },
  } = useSuspenseQuery(videoRetentionQueryOptions(api, videoId));
  const { tOr } = useT();

  return (
    <>
      <h3>{tOr('studio.retentionTitle', {}, '')}</h3>
      <RetentionChart curve={curve} />
    </>
  );
}
