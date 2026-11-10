import { Link } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import type { ReactNode } from 'react';
import { useShortsNavigation } from '#app/features/shorts/hooks/use-shorts-navigation';
import { ShortsFeed } from '../shorts-feed/shorts-feed';

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

export interface ShortsPageProps {
  renderComments: (videoId: string) => ReactNode;
}

/** `/shorts`: the feed that opens on the Short the URL names. */
export function ShortsPage({ renderComments }: ShortsPageProps) {
  const { shorts, named, hasMore, loadMore } = useShortsNavigation();

  if (shorts.length === 0) {
    return <ShortsEmpty />;
  }

  return (
    <ShortsFeed
      shorts={shorts}
      named={named}
      hasMore={hasMore}
      loadMore={loadMore}
      renderComments={renderComments}
    />
  );
}
