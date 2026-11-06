import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { api, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { OwnVideos } from '../own-videos';

function renderOwnVideos(titles: string[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    myVideosQueryOptions(api).queryKey,
    feedPages(titles.map((title) => videoSummary({ title })))
  );

  return renderPage(<OwnVideos />, AppProviders, { queryClient });
}

describe('apps/client/web: own videos', () => {
  it('lists the viewer uploads under a heading', async () => {
    const markup = await renderOwnVideos(['First upload', 'Second upload']);

    expect(markup).toContain('>Your videos</h2>');
    expect(markup).toContain('First upload');
    expect(markup).toContain('Second upload');
  });

  it('renders nothing for a viewer with no upload', async () => {
    expect(await renderOwnVideos([])).toBe('');
  });
});
