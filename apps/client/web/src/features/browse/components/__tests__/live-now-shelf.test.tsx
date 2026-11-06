import { createQueryClient } from '@vp/queries';
import { api, LIVE_STREAM_ID, liveStream } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { liveNowQueryOptions } from '#app/features/live/api/live-queries';
import { LiveNowShelf } from '../live-now-shelf';

function renderShelf(items: ReturnType<typeof liveStream>[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(liveNowQueryOptions(api).queryKey, { items });
  return renderPage(<LiveNowShelf />, AppProviders, { queryClient });
}

describe('apps/client/web: LiveNowShelf', () => {
  it('lists every broadcast live now under the Live now heading', async () => {
    const markup = await renderShelf([liveStream()]);

    expect(markup).toContain('>Live now</h2>');
    expect(markup).toContain(`href="/live/${LIVE_STREAM_ID}"`);
  });

  it('renders nothing when nothing is live', async () => {
    expect(await renderShelf([])).toBe('');
  });
});
