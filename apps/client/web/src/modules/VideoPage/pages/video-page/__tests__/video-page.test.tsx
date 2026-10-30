import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { api, VIDEO_ID, video } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { VideoPage } from '../video-page';

function renderVideoPage(overrides: Parameters<typeof video>[0] = {}): Promise<string> {
  const queryClient = createQueryClient();
  queryClient.setQueryData(videoQueryOptions(api, VIDEO_ID).queryKey, video(overrides));

  return renderPage(<VideoPage />, AppProviders, {
    queryClient,
    url: `/watch/${VIDEO_ID}`,
    route: '/watch/$videoId',
  });
}

describe('apps/client/web: video page', () => {
  it('shows the player frame over the details of the video the loader put in the cache', async () => {
    const markup = await renderVideoPage({
      title: 'Launch day',
      posterUrl: 'http://localhost:9000/posters/p.jpg',
    });

    expect(markup.indexOf('Launch day')).toBeGreaterThan(markup.indexOf('posters/p.jpg'));
    expect(markup.indexOf('posters/p.jpg')).toBeGreaterThan(-1);
  });
});
