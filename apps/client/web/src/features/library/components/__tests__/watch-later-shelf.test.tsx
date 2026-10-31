import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';

import { WATCH_LATER_ID } from '#app/features/library/__tests__/library-fixtures';
import { myPlaylistsQueryOptions } from '#app/features/library/api/library-queries';
import { WatchLaterShelf } from '../watch-later-shelf';
import { WATCH_LATER, youCache } from './you-cache';

describe('apps/client/web: WatchLaterShelf', () => {
  it('links its heading to the Watch Later list and shows what is saved on it', async () => {
    const markup = await renderPage(<WatchLaterShelf />, signedIn(), { queryClient: youCache() });

    expect(markup).toContain(`href="/playlist?list=${WATCH_LATER_ID}"`);
    expect(markup).toContain('Saved for later');
  });

  it('offers the empty line when the list holds nothing', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(myPlaylistsQueryOptions(api).queryKey, { items: [WATCH_LATER] });

    const markup = await renderPage(<WatchLaterShelf />, signedIn(), { queryClient });

    expect(markup).toContain('Videos you save for later show up here');
  });
});
