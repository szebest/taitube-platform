import { type ApiStore, createApiStore, seed } from '../../../../../__tests__/api-store';
import { VIDEO_ID, video } from '../../../../../__tests__/fixtures';
import { renderPage } from '../../../../../__tests__/render-page';
import { videosApi } from '../../../../shared/api/videos-api';
import { VideoPage } from '../video-page';

function renderWatch(store: ApiStore): string {
  return renderPage(<VideoPage />, { store, url: `/watch/${VIDEO_ID}`, route: '/watch/:videoId' });
}

describe('apps/web: video page', () => {
  it('renders nothing without a video in the address', () => {
    expect(renderPage(<VideoPage />, { url: '/watch' })).toBe('');
  });

  it('shows the spinner while the video loads', () => {
    expect(renderWatch(createApiStore())).toContain('aria-label="Loading"');
  });

  it('plays the video over its details', async () => {
    const store = createApiStore();
    await seed(
      store,
      (target) => target.dispatch(videosApi.endpoints.video.initiate(VIDEO_ID)),
      video({ title: 'Launch day', playbackUrl: 'http://localhost:9000/hls/master.m3u8' })
    );

    const markup = renderWatch(store);

    expect(markup.indexOf('width:100%')).toBeGreaterThan(-1);
    expect(markup.indexOf('Launch day')).toBeGreaterThan(markup.indexOf('width:100%'));
  });
});
