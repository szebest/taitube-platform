import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader, PageHeaderSkeleton } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Tabs } from '@vp/ui';

import { VideoCardSkeleton } from '#app/components/video/video-card';

import { LIBRARY_TABS } from '../library-search';
import { ClearHistoryDialog } from './clear-history-dialog';
import { CommentsList } from './comments-list';
import { HistoryList } from './history-list';
import { LibraryToolbar } from './library-toolbar';
import { LikedList } from './liked-list';
import { SearchHistoryList } from './search-history-list';

/** `/feed/history`: the viewer's watch history, and beside it their searches, likes and comments. */
export function LibraryPage() {
  const { tab = 'history', q } = useSearch({ from: '/_authed/feed/history' });
  const navigate = useNavigate({ from: '/feed/history' });
  const { tOr } = useT();

  const openTab = (next: string) => {
    const picked = LIBRARY_TABS.find((candidate) => candidate === next);
    if (picked)
      void navigate({ search: (previous) => ({ ...previous, tab: picked }), replace: true });
  };

  return (
    <Tabs.Root value={tab} onValueChange={openTab} className="tw:flex tw:flex-col tw:gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('library.historyTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Tabs>
          <Tabs.List aria-label={tOr('library.tabsLabel', {}, '')}>
            {LIBRARY_TABS.map((value) => (
              <Tabs.Tab key={value} value={value}>
                {tOr('library.tab', { tab: value }, '')}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </PageHeader.Tabs>
      </PageHeader.Root>
      <Tabs.Panel value="history" className="tw:flex tw:flex-col tw:gap-6">
        <LibraryToolbar scope="history" filter={q} />
        <HistoryList filter={q} />
      </Tabs.Panel>
      <Tabs.Panel value="searches" className="tw:flex tw:flex-col tw:gap-6">
        <LibraryToolbar scope="searches" />
        <SearchHistoryList />
      </Tabs.Panel>
      <Tabs.Panel value="liked">
        <LikedList />
      </Tabs.Panel>
      <Tabs.Panel value="comments">
        <CommentsList />
      </Tabs.Panel>
      <ClearHistoryDialog />
    </Tabs.Root>
  );
}

export function LibraryPageSkeleton() {
  return (
    <div aria-hidden="true" className="tw:flex tw:flex-col tw:gap-6">
      <PageHeaderSkeleton />
      <VideoCardSkeleton variant="row" count={4} />
    </div>
  );
}
