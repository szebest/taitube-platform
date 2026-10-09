import { VIDEO_ID, videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { useVideoPages } from '../use-video-pages';

const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';
const options = publicFeedQueryOptions({ sort: 'recent' });

function FeedProbe() {
  const { videos, hasMore } = useVideoPages(options);
  return <span>{`${videos.map(({ id }) => id).join(',')} more=${hasMore}`}</span>;
}

async function renderFeed(lastCursor: string | null): Promise<string> {
  const queryClient = createQueryClient();
  queryClient.setQueryData(options.queryKey, {
    pages: [
      { items: [videoSummary()], nextCursor: 'next', total: 2 },
      { items: [videoSummary({ id: SECOND_VIDEO_ID })], nextCursor: lastCursor, total: 2 },
    ],
    pageParams: [undefined, 'next'],
  });
  return renderPage(<FeedProbe />, { queryClient });
}

describe('apps/client/web: useVideoPages', () => {
  it('lists the videos of every loaded page in feed order', async () => {
    expect(await renderFeed(null)).toContain(`${VIDEO_ID},${SECOND_VIDEO_ID}`);
  });

  it.each([
    { page: 'the last page', lastCursor: null, more: false },
    { page: 'a page with a cursor', lastCursor: 'after', more: true },
  ])('offers more after $page: $more', async ({ lastCursor, more }) => {
    expect(await renderFeed(lastCursor)).toContain(`more=${more}`);
  });
});
