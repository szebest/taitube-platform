import { StatCard } from '@kit/components';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { parkedDlqQueryOptions } from '#app/features/admin/api/admin-dlq';
import { useT } from '#app/lib/messages';

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
