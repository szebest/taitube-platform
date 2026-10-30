import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { myClipsQueryOptions, useApi } from '@vp/queries';

import { Shelf } from '#app/components/discovery/shelf';

import { ClipCard } from './clip-card';

/** The viewer's own clips, newest first, each linking to its clip page; one empty line when there are none. */
export function ClipsShelf() {
  const api = useApi();
  const { tOr } = useT();
  const { data, hasNextPage, fetchNextPage } = useSuspenseInfiniteQuery(myClipsQueryOptions(api));
  const clips = data.pages.flatMap((page) => page.items);

  if (clips.length === 0) {
    return (
      <EmptyState.Root size="section">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title asChild>
          <h2>{tOr('clips.shelfEmpty', {}, '')}</h2>
        </EmptyState.Title>
      </EmptyState.Root>
    );
  }

  return (
    <Shelf.Root onEndReached={() => hasNextPage && fetchNextPage({ cancelRefetch: false })}>
      <Shelf.Header>
        <Shelf.Title>{tOr('clips.shelfTitle', {}, '')}</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {clips.map((clip) => (
          <Shelf.Item key={clip.id}>
            <ClipCard clip={clip} />
          </Shelf.Item>
        ))}
      </Shelf.Track>
    </Shelf.Root>
  );
}
