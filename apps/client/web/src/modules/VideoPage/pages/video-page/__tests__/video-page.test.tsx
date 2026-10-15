import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, video } from '@vp/web-testing';

import { renderPage } from '#app/__tests__/render-page';
import { api } from '#app/__tests__/api';
import { VideoPage } from '../video-page';

describe('apps/client/web: video page', () => {
  it('shows the player frame over the details of the video the loader put in the cache', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      videoQueryOptions(api, VIDEO_ID).queryKey,
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
