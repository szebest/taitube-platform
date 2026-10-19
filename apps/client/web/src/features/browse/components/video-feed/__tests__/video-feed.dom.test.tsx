import { act, screen } from '@testing-library/react';
import { type FeedResponse, getFeed } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { getRouter } from '#app/router';

const NEXT_CURSOR = 'cursor-2';

class RecordingObserver implements IntersectionObserver {
  static latest: RecordingObserver | undefined;
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds = [0];

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.rootMargin = options.rootMargin ?? '0px';
    RecordingObserver.latest = this;
  }

  enterView(): void {
    act(() => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this));
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

type NextPage = 'answered' | 'failed';

const FIRST_PAGE: FeedResponse = {
  items: [videoSummary({ title: 'First page' })],
  nextCursor: NEXT_CURSOR,
  total: 2,
};

function feedApi(asked: (string | null)[], next: NextPage[], first: FeedResponse) {
  return [
    mockEndpoint(getFeed, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      asked.push(cursor);
      if (cursor === null) {
        return HttpResponse.json(first);
      }
      if (next.shift() === 'failed') {
        return problemReply(ErrorCodes.INTERNAL);
      }
      return HttpResponse.json({
        items: [videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a002', title: 'Next page' })],
        nextCursor: null,
        total: 2,
      });
    }),
  ];
}

async function renderTrending(next: NextPage[] = ['answered'], first = FIRST_PAGE) {
  vi.stubGlobal('IntersectionObserver', RecordingObserver);
  RecordingObserver.latest = undefined;
  const asked: (string | null)[] = [];
  const rendered = await renderRoute(getRouter, '/feed/trending', {
    handlers: feedApi(asked, next, first),
  });
  await screen.findByRole('heading', { name: 'Trending' });
  return { ...rendered, asked, sentinel: () => RecordingObserver.latest };
}

describe('apps/client/web: video feed in the browser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the next page while the sentinel is still below the fold', async () => {
    const { asked, sentinel } = await renderTrending();
    await screen.findByRole('link', { name: 'First page' });

    expect(sentinel()?.rootMargin).toMatch(/^0px 0px [1-9]\d*px 0px$/);
    sentinel()?.enterView();

    expect(await screen.findByRole('link', { name: 'Next page' })).toBeInTheDocument();
    expect(asked).toEqual([null, NEXT_CURSOR]);
  });

  it('offers a retry when the next page fails, and loads it on the retry', async () => {
    const { asked, sentinel, user } = await renderTrending(['failed', 'answered']);
    await screen.findByRole('link', { name: 'First page' });

    sentinel()?.enterView();
    expect(await screen.findByRole('alert')).toHaveTextContent('More videos could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Next page' })).toBeInTheDocument();
    expect(asked.filter((cursor) => cursor === NEXT_CURSOR)).toHaveLength(2);
  });

  it('says the feed is empty, with no sentinel to load more', async () => {
    const { sentinel } = await renderTrending([], { items: [], nextCursor: null, total: 0 });

    expect(screen.getByText('No videos here yet')).toBeInTheDocument();
    expect(sentinel()).toBeUndefined();
  });
});
