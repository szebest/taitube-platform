import { renderToStaticMarkup } from 'react-dom/server';

import { AppProviders } from '#app/__tests__/providers';

import { PlaylistPageSkeleton } from '../playlist-page-skeleton';

describe('apps/client/web: the playlist page skeleton', () => {
  it('stands in for the page, hidden from assistive technology', () => {
    const markup = renderToStaticMarkup(
      <AppProviders>
        <PlaylistPageSkeleton />
      </AppProviders>
    );

    expect(markup).toContain('aria-hidden="true"');
  });
});
