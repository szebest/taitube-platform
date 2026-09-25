import { type ApiStore, createApiStore, seed } from '#app/__tests__/api-store';
import { VIDEO_ID, video } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { videosApi } from '#app/modules/shared/api/videos-api';
import { EditPage } from '../edit-page';

async function renderEdit(store: ApiStore): Promise<string> {
  return renderPage(<EditPage />, {
    store,
    url: `/upload/edit/${VIDEO_ID}`,
    route: '/upload/edit/$videoId',
    layout: '_authed',
  });
}

describe('apps/web: edit page', () => {
  it('shows the spinner while the video loads', async () => {
    expect(await renderEdit(createApiStore())).toContain('aria-label="Loading"');
  });

  it('opens the edit form for the loaded video', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(videosApi.endpoints.video.initiate(VIDEO_ID)),
      video({ title: 'Launch day' })
    );

    const markup = await renderEdit(store);

    expect(markup).toContain('Editing video: Launch day');
    expect(markup).toContain('>Edit</button>');
  });
});
