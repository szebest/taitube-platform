import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { api, VIDEO_ID, video } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { EditPage } from '../edit-page';

function renderEditPage(title: string): Promise<string> {
  const queryClient = createQueryClient();
  queryClient.setQueryData(videoQueryOptions(api, VIDEO_ID).queryKey, video({ title }));

  return renderPage(<EditPage />, AppProviders, {
    queryClient,
    url: `/upload/edit/${VIDEO_ID}`,
    route: '/upload/edit/$videoId',
    layout: '_authed',
  });
}

describe('apps/client/studio: edit page', () => {
  it('opens the edit form for the video the loader put in the cache', async () => {
    const markup = await renderEditPage('Launch day');

    expect(markup).toContain('Editing video: Launch day');
    expect(markup).toContain('value="Launch day"');
    expect(markup).toContain('>Edit</button>');
  });
});
