import { videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { VideosContainer, type VideosContainerProps } from '../videos-container';

const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

const videos = [
  videoSummary({ title: 'First' }),
  videoSummary({ id: SECOND_VIDEO_ID, title: 'Second' }),
];

async function renderVideos(props: VideosContainerProps): Promise<string> {
  return renderPage(<VideosContainer {...props} />, { viewer: null });
}

describe('apps/client/web: videos container', () => {
  it('shows a card for every video of the feed, in feed order', async () => {
    const markup = await renderVideos({ videos });

    expect(markup.indexOf('First')).toBeGreaterThan(-1);
    expect(markup.indexOf('Second')).toBeGreaterThan(markup.indexOf('First'));
  });

  it.each<{ scenario: string; props: VideosContainerProps; loading: boolean; retry: boolean }>([
    { scenario: 'a loaded feed', props: { videos }, loading: false, retry: false },
    {
      scenario: 'a feed being fetched',
      props: { videos, isFetching: true },
      loading: true,
      retry: false,
    },
    {
      scenario: 'a page that failed',
      props: { videos, isError: true },
      loading: false,
      retry: true,
    },
  ])(
    'shows the spinner and the retry button as $scenario needs',
    async ({ props, loading, retry }) => {
      const markup = await renderVideos(props);

      expect(markup.includes('aria-label="Loading"')).toBe(loading);
      expect(markup.includes('aria-label="retry"')).toBe(retry);
    }
  );
});
