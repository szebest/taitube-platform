import { renderPage } from '@vp/web-testing/server';

import { signedIn } from '#app/__tests__/providers';

import { HistoryShelf } from '../history-shelf';
import { youCache } from './you-cache';

describe('apps/client/web: HistoryShelf', () => {
  it('links its heading to the history page and lists what was watched, partly watched', async () => {
    const markup = await renderPage(<HistoryShelf />, signedIn(), { queryClient: youCache() });

    expect(markup).toMatch(/<h2[^>]*><a[^>]*href="\/feed\/history"[^>]*>History<\/a><\/h2>/);
    expect(markup).toContain('Tram ride');
    expect(markup).toContain('data-slot="video-thumbnail-progress"');
  });
});
