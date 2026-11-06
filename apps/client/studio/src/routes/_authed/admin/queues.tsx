import { createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';
import { useId } from 'react';
import { BULL_BOARD_URL } from '#app/config';
import { adminDlqQueryOptions, DlqSearchSchema } from '#app/features/admin/api/admin-dlq';
import { DlqParkedCount } from '#app/features/admin/components/dlq-parked-count';
import { DlqTable } from '#app/features/admin/components/dlq-table';

function QueuesPage() {
  const { tOr } = useT();
  const dlqId = useId();

  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-center gap-stack">
        <Button asChild variant="outline">
          <a href={BULL_BOARD_URL} target="_blank" rel="noreferrer">
            {tOr('studio.adminQueuesBullBoard', {}, '')}
          </a>
        </Button>
        <p className="m-0 text-caption text-fg-muted">
          {tOr('studio.adminQueuesBullBoardHint', {}, '')}
        </p>
      </div>
      <DlqParkedCount />
      <section aria-labelledby={dlqId} className="flex flex-col gap-stack">
        <h2 id={dlqId} className="m-0 text-title">
          {tOr('studio.adminDlqTitle', {}, '')}
        </h2>
        <DlqTable />
      </section>
    </div>
  );
}

export const Route = createFileRoute('/_authed/admin/queues')({
  validateSearch: DlqSearchSchema,
  loaderDeps: ({ search: { status } }) => ({ status }),
  loader: async ({ context: { queryClient, api }, deps: { status } }) => {
    await queryClient.prefetchInfiniteQuery(adminDlqQueryOptions(api, status));
  },
  component: QueuesPage,
});
