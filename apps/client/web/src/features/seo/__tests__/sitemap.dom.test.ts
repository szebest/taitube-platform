import { getFeed } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { sitemapResponse } from '../sitemap';

const SITE = 'https://taitube.test';
const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

function feedOf(...items: ReturnType<typeof videoSummary>[]) {
  return mockEndpoint(getFeed, () =>
    HttpResponse.json({ items, nextCursor: null, total: items.length })
  );
}

describe('apps/client/web: sitemapResponse', () => {
  it('lists every public video of the feed with its last change, as well-formed XML', async () => {
    apiServer.use(
      feedOf(
        videoSummary({ updatedAt: '2026-02-01T00:00:00.000Z' }),
        videoSummary({ id: OTHER_ID, title: 'A & B' })
      )
    );

    const response = await sitemapResponse(api, SITE);

    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    const document = new DOMParser().parseFromString(await response.text(), 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect([...document.querySelectorAll('url > loc')].map((loc) => loc.textContent)).toEqual([
      `${SITE}/watch/0190c3a0-5e1d-7000-8000-00000000a001`,
      `${SITE}/watch/${OTHER_ID}`,
    ]);
    expect(document.querySelector('url > lastmod')?.textContent).toBe('2026-02-01T00:00:00.000Z');
  });

  it('is an empty urlset when no video is public', async () => {
    apiServer.use(feedOf());

    const document = new DOMParser().parseFromString(
      await (await sitemapResponse(api, SITE)).text(),
      'application/xml'
    );

    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelectorAll('url')).toHaveLength(0);
  });
});
