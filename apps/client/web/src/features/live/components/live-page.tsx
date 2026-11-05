import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { liveNowQueryOptions } from '../api/live-queries';
import { LiveStreamCard } from './live-stream-card';

const GRID =
  'tw:m-0 tw:grid tw:list-none tw:grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] tw:gap-x-grid-x tw:gap-y-grid-y tw:p-0';

/** `/live`: every public broadcast live now, the latest to start first. */
export function LivePage() {
  const api = useApi();
  const { tOr } = useT();

  const { data } = useSuspenseQuery(liveNowQueryOptions(api));

  if (data.items.length === 0) {
    return (
      <EmptyState.Root size="page">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title asChild>
          <h1>{tOr('live.emptyTitle', {}, '')}</h1>
        </EmptyState.Title>
        <EmptyState.Description>{tOr('live.emptyDescription', {}, '')}</EmptyState.Description>
        <EmptyState.Action asChild>
          <Link to="/">{tOr('live.browse', {}, '')}</Link>
        </EmptyState.Action>
      </EmptyState.Root>
    );
  }

  return (
    <section className="tw:flex tw:flex-col tw:gap-section">
      <h1 className="tw:m-0 tw:text-title-lg">{tOr('live.nowShelf', {}, '')}</h1>
      <ul className={GRID}>
        {data.items.map((stream) => (
          <li key={stream.id}>
            <LiveStreamCard stream={stream} variant="grid" />
          </li>
        ))}
      </ul>
    </section>
  );
}
