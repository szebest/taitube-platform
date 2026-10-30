import { useSuspenseQuery } from '@tanstack/react-query';
import { ClientOnly, Link, useLocation } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { Suspense } from 'react';

import { ShelfSkeleton } from '#app/components/discovery/shelf';
import { SignedOutSection } from '#app/components/states/signed-out-section';
import { ShortsShelf } from '#app/features/browse/components/shorts-shelf';
import { homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomeShelf } from '../home-shelf/home-shelf';

export function HomePage() {
  const api = useApi();
  const account = useAccount();
  const href = useLocation({ select: (location) => location.href });
  const { tOr } = useT();

  const { data } = useSuspenseQuery(homeQueryOptions(api));

  if (data.shelves.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>{tOr('home.empty', {}, '')}</EmptyState.Title>
      </EmptyState.Root>
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      {data.shelves.map((shelf) => (
        <HomeShelf key={`${shelf.kind}:${shelf.subject?.id ?? ''}`} shelf={shelf} />
      ))}
      <ClientOnly>
        <Suspense fallback={null}>
          <ShortsShelf />
        </Suspense>
      </ClientOnly>
      {!account && (
        <SignedOutSection.Root>
          <SignedOutSection.Line>
            {tOr('home.signedOutSubscriptions', {}, '')}
          </SignedOutSection.Line>
          <SignedOutSection.Action asChild>
            <Link to="/login" search={{ redirect: href }}>
              {tOr('auth.signIn', {}, '')}
            </Link>
          </SignedOutSection.Action>
        </SignedOutSection.Root>
      )}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div aria-hidden="true" className="tw:flex tw:flex-col tw:gap-section">
      <ShelfSkeleton />
      <ShelfSkeleton />
    </div>
  );
}
