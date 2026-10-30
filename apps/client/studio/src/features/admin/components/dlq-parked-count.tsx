import { useQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { StatCard } from '#app/components/analytics/stat-card';
import { parkedDlqQueryOptions } from '#app/features/admin/api/admin-dlq';

/** How many dead-letter jobs wait, as a stat; "30+" when the first page is not all of them. */
export function DlqParkedCount() {
  const { tOr } = useT();
  const parked = useQuery(parkedDlqQueryOptions(useApi()));

  const state = (() => {
    if (parked.isPending) {
      return { state: 'loading' } as const;
    }
    if (parked.isError) {
      return { state: 'error', onRetry: () => parked.refetch() } as const;
    }
    return { state: 'ready' } as const;
  })();

  return (
    <StatCard.Root {...state}>
      <StatCard.Label>{tOr('studio.adminDlqParked', {}, '')}</StatCard.Label>
      <StatCard.Value>
        {parked.data &&
          tOr(
            parked.data.more ? 'studio.adminDlqCountMore' : 'studio.adminDlqCount',
            { count: parked.data.count },
            ''
          )}
      </StatCard.Value>
    </StatCard.Root>
  );
}
