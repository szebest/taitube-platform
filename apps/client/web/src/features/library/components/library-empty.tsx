import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';

import type { LibraryTab } from '../library-search';

export interface LibraryEmptyProps {
  tab: LibraryTab;
}

/** A tab with nothing in it yet. */
export function LibraryEmpty({ tab }: LibraryEmptyProps) {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="section" role="status">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title>{tOr('library.empty', { tab }, '')}</EmptyState.Title>
    </EmptyState.Root>
  );
}
