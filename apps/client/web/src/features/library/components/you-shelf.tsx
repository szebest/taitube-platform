import { EmptyLibraryIllustration, EmptyState, Shelf } from '@vp/components';
import { useT } from '@vp/intl-react';
import type { ReactElement, ReactNode } from 'react';

type YouShelfId = 'history' | 'watchLater' | 'playlists' | 'videos';

export interface YouShelfProps {
  shelf: YouShelfId;
  /** The link around the heading to the shelf's full page. */
  link: (label: string) => ReactElement;
  /** The one action an empty shelf offers. */
  action: { label: string; link: (label: string) => ReactElement };
  /** The cards, each in a `Shelf.Item`; none shows the empty line instead of an empty row. */
  children: ReactNode[];
}

/** One shelf of the You hub: a heading that links to its page, its cards, or one line and one action. */
export function YouShelf({ shelf, link, action, children }: YouShelfProps) {
  const { tOr } = useT();

  return (
    <Shelf.Root>
      <Shelf.Header>
        <Shelf.Title asChild>
          <h2>{link(tOr('library.shelf', { shelf }, ''))}</h2>
        </Shelf.Title>
      </Shelf.Header>
      {children.length > 0 ? (
        <Shelf.Track>{children}</Shelf.Track>
      ) : (
        <EmptyState.Root size="inline" role="status">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('library.shelfEmpty', { shelf }, '')}</EmptyState.Title>
          <EmptyState.Action asChild>{action.link(action.label)}</EmptyState.Action>
        </EmptyState.Root>
      )}
    </Shelf.Root>
  );
}
