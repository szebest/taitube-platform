import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';

import { DataTableSkeleton } from '#app/components/table/data-table';
import { useSelectedVideo } from '#app/features/shell/hooks/selected-video';
import { LIBRARY_SKELETON_COLUMNS } from './library-columns';
import { LibraryTable } from './library-table';

export function LibraryPage() {
  const { tOr } = useT();
  const { open } = useSelectedVideo('LibraryPage');

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.libraryTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <LibraryTable onInspect={open} />
    </div>
  );
}

export function LibraryPageSkeleton() {
  return <DataTableSkeleton columns={LIBRARY_SKELETON_COLUMNS} />;
}
