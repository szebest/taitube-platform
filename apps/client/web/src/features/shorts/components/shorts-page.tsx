import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';

import { PlayerChannelProvider } from '#app/features/player';

import { useShortsNavigation } from '../hooks/use-shorts-navigation';
import { ShortsFeedFrame } from './shorts-feed-frame';

function ShortsEmpty() {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="page">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h1>{tOr('shorts.emptyTitle', {}, '')}</h1>
      </EmptyState.Title>
      <EmptyState.Description>{tOr('shorts.emptyDescription', {}, '')}</EmptyState.Description>
      <EmptyState.Action asChild>
        <Link to="/">{tOr('shorts.browse', {}, '')}</Link>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}

/** `/shorts`: the Short the URL names in its frame, with the posters of the next two already on their way. */
export function ShortsPage() {
  const { current, upcoming } = useShortsNavigation();

  if (!current) {
    return <ShortsEmpty />;
  }

  return (
    <PlayerChannelProvider>
      {upcoming.map(
        ({ id, posterUrl }) =>
          posterUrl && <link key={id} rel="preload" as="image" href={posterUrl} />
      )}
      <ShortsFeedFrame short={current} />
    </PlayerChannelProvider>
  );
}
