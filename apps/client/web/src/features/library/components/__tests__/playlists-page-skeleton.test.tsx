import { renderToStaticMarkup } from 'react-dom/server';

import { AppProviders } from '#app/__tests__/providers';

import { PlaylistsPageSkeleton } from '../playlists-page-skeleton';

describe('apps/client/web: the playlists page skeleton', () => {
  it('stands in for the page, hidden from assistive technology', () => {
    const markup = renderToStaticMarkup(
      <AppProviders>
        <PlaylistsPageSkeleton />
      </AppProviders>
    );

    expect(markup).toContain('aria-hidden="true"');
  });
});
