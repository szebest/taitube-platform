import { getFeed } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { videoFeedResponse } from '../video-feed';

const SITE = 'https://taitube.test';

describe('apps/client/web: videoFeedResponse', () => {
  it('is an RSS 2.0 feed of the newest public videos, text escaped', async () => {
    const video = videoSummary({
      title: 'Tom & Jerry <live>',
      description: null,
      readyAt: '2026-01-02T03:04:05.000Z',
    });
    apiServer.use(
      mockEndpoint(getFeed, () => HttpResponse.json({ items: [video], nextCursor: null, total: 1 }))
    );

    const response = await videoFeedResponse(api, SITE);

    expect(response.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8');
    const document = new DOMParser().parseFromString(await response.text(), 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.getAttribute('version')).toBe('2.0');
    expect(document.querySelector('channel > link')?.textContent).toBe(SITE);
    expect(document.querySelector('item > title')?.textContent).toBe('Tom & Jerry <live>');
    expect(document.querySelector('item > link')?.textContent).toBe(`${SITE}/watch/${video.id}`);
    expect(document.querySelector('item > guid')?.getAttribute('isPermaLink')).toBe('true');
    expect(document.querySelector('item > pubDate')?.textContent).toBe(
      'Fri, 02 Jan 2026 03:04:05 GMT'
    );
  });
});
