import { createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { prefetched } from '@vp/queries';
import { useId } from 'react';
import {
  AdminPageSkeleton,
  adminCategoriesQueryOptions,
  adminVideosQueryOptions,
  ModerationSearchSchema,
  ModerationTable,
  ReportQueue,
} from '#app/features/admin';

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
      prefetched(queryClient.infiniteQuery(adminVideosQueryOptions(api, deps))),
      prefetched(queryClient.query(adminCategoriesQueryOptions(api))),
    ]);
  },
  pendingComponent: AdminPageSkeleton,
  component: ModerationPage,
});
