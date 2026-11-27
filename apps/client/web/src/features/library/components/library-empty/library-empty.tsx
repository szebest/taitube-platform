import { EmptyLibraryIllustration, EmptyState } from '@kit/components';
import type { LibraryTab } from '#app/features/library/utils/library-search';
import { useT } from '#app/lib/messages';

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
