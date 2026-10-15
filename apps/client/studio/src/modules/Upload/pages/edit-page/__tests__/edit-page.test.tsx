import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { VIDEO_ID, video } from '@vp/web-testing';

import { renderPage } from '#app/__tests__/render-page';
import { api } from '#app/__tests__/api';
import { EditPage } from '../edit-page';

describe('apps/client/studio: edit page', () => {
  it('opens the edit form for the video the loader put in the cache', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      videoQueryOptions(api, VIDEO_ID).queryKey,
      video({ title: 'Launch day' })
    );

    const markup = await renderPage(<EditPage />, {
      queryClient,
      url: `/upload/edit/${VIDEO_ID}`,
      route: '/upload/edit/$videoId',
      layout: '_authed',
    });

    expect(markup).toContain('Editing video: Launch day');
    expect(markup).toContain('value="Launch day"');
    expect(markup).toContain('>Edit</button>');
  });
});
