import { createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useId } from 'react';
import { adminCategoriesQueryOptions } from '#app/features/admin/api/admin-categories';
import { adminVideosQueryOptions } from '#app/features/admin/api/admin-videos';
import { ModerationSearchSchema } from '#app/features/admin/api/moderation-search';
import { ModerationTable } from '#app/features/admin/components/moderation-table/moderation-table';
import { ReportQueue } from '#app/features/admin/components/report-queue/report-queue';

function ModerationPage() {
  const { tOr } = useT();
  const videosId = useId();
  const reportsId = useId();

  return (
    <div className="flex flex-col gap-stack">
      <section aria-labelledby={videosId} className="flex flex-col gap-stack">
        <h2 id={videosId} className="m-0 text-title">
          {tOr('studio.adminVideosTitle', {}, '')}
        </h2>
        <ModerationTable />
      </section>
      <section aria-labelledby={reportsId} className="flex flex-col gap-stack">
        <h2 id={reportsId} className="m-0 text-title">
          {tOr('studio.adminReportsTitle', {}, '')}
        </h2>
        <ReportQueue />
      </section>
    </div>
  );
}

export const Route = createFileRoute('/_authed/admin/moderation')({
  validateSearch: ModerationSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient, api }, deps }) => {
    await Promise.all([
      queryClient.prefetchInfiniteQuery(adminVideosQueryOptions(api, deps)),
      queryClient.prefetchQuery(adminCategoriesQueryOptions(api)),
    ]);
  },
  component: ModerationPage,
});
