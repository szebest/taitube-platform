import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';

import { myPlaylistsQueryOptions } from '../../api/library-queries';
import { PlaylistsShelf } from '../playlists-shelf';
import { WATCH_LATER, youCache } from './you-cache';

describe('apps/client/web: PlaylistsShelf', () => {
  it("lists the viewer's own playlists and leaves Watch Later to its own shelf", async () => {
    const markup = await renderPage(<PlaylistsShelf />, signedIn(), { queryClient: youCache() });

    expect(markup).toContain('href="/feed/playlists"');
    expect(markup).toContain('Road trips');
    expect(markup).not.toContain('>Watch later<');
  });

  it('offers the empty line when the viewer made none', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(myPlaylistsQueryOptions(api).queryKey, { items: [WATCH_LATER] });

    const markup = await renderPage(<PlaylistsShelf />, signedIn(), { queryClient });

    expect(markup).toContain('Playlists you make show up here');
  });
});
