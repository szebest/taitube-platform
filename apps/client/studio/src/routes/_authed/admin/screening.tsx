import { createFileRoute } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { prefetched } from '@vp/queries';
import {
  adminScreeningQueryOptions,
  ScreeningQueue,
  ScreeningSearchSchema,
} from '#app/features/admin';

function ScreeningPage() {
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-stack">
      <h2 className="m-0 text-title">{tOr('studio.screeningTitle', {}, '')}</h2>
      <p className="m-0 text-fg-muted">{tOr('studio.screeningIntro', {}, '')}</p>
      <ScreeningQueue />
    </div>
  );
}

export const Route = createFileRoute('/_authed/admin/screening')({
  validateSearch: ScreeningSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient, api }, deps }) =>
    prefetched(queryClient.infiniteQuery(adminScreeningQueryOptions(api, deps.state))),
  component: ScreeningPage,
});
