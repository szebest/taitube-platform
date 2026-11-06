import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';

import { liveNowQueryOptions } from '../api/live-queries';
import { LiveStreamCard } from './live-stream-card';

const GRID =
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-x-grid-x gap-y-grid-y p-0';

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
    <section className="flex flex-col gap-section">
      <h1 className="m-0 text-title-lg">{tOr('live.nowShelf', {}, '')}</h1>
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
