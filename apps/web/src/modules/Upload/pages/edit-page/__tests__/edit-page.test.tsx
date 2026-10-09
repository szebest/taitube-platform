import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { EditPage } from '../edit-page';

describe('apps/web: edit page', () => {
  it('opens the edit form for the video the loader put in the cache', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(videoQueryOptions(VIDEO_ID).queryKey, video({ title: 'Launch day' }));

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
