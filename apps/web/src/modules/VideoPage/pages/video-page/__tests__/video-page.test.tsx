import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { videoQueryOptions } from '#app/features/watch/api/video-query-options';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { VideoPage } from '../video-page';

describe('apps/web: video page', () => {
  it('shows the player frame over the details of the video the loader put in the cache', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      videoQueryOptions(VIDEO_ID).queryKey,
      video({ title: 'Launch day', posterUrl: 'http://localhost:9000/posters/p.jpg' })
    );

    const markup = await renderPage(<VideoPage />, {
      queryClient,
      url: `/watch/${VIDEO_ID}`,
      route: '/watch/$videoId',
    });

    expect(markup.indexOf('Launch day')).toBeGreaterThan(markup.indexOf('posters/p.jpg'));
    expect(markup.indexOf('posters/p.jpg')).toBeGreaterThan(-1);
  });
});
