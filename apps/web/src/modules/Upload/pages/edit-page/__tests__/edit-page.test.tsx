import { type ApiStore, createApiStore, seed } from '../../../../../__tests__/api-store';
import { VIDEO_ID, video } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { videosApi } from '../../../../shared/api/videos-api';
import { EditPage } from '../edit-page';

function renderEdit(store: ApiStore): string {
  return renderPage(<EditPage />, { store, url: `/upload/edit/${VIDEO_ID}`, route: '/upload/edit/:videoId' });
}

describe('apps/web: edit page', () => {
  it('renders nothing without a video in the address', () => {
    expect(renderPage(<EditPage />, { url: '/upload/edit' })).toBe('');
  });

  it('shows the spinner while the video loads', () => {
    expect(renderEdit(createApiStore())).toContain('aria-label="Loading"');
  });

  it('opens the edit form for the loaded video', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(videosApi.endpoints.video.initiate(VIDEO_ID)),
      video({ title: 'Launch day' })
    );

    const markup = renderEdit(store);

    expect(markup).toContain('Editing video: Launch day');
    expect(markup).toContain('>Edit</button>');
  });
});
