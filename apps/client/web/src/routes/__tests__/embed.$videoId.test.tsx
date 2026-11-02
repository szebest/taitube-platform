import { getVideo } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, video } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw/http';

import { headOf } from '#app/__tests__/head-tags';
import { getRouter } from '#app/router';

function embed(path: string, overrides: Parameters<typeof video>[0] = {}) {
  return serverRender(getRouter, path, {
    handlers: [
      mockEndpoint(getVideo, () =>
        HttpResponse.json(
          video({
            title: 'Launch day',
            posterUrl: 'http://localhost:9000/posters/p.jpg',
            playbackUrl: 'http://localhost:9000/hls/master.m3u8',
            ...overrides,
          })
        )
      ),
    ],
  });
}

describe('apps/client/web: /embed/$videoId', () => {
  it('server-renders the poster in a full-frame box, with no app shell around it', async () => {
    const { status, html } = await embed(`/embed/${VIDEO_ID}`);

    expect(status).toBe(200);
    expect(html).toContain('src="http://localhost:9000/posters/p.jpg"');
    expect(html).not.toContain('<header');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('<h1');
  });

  it('leaves the legacy stylesheets out of the head and keeps the design system, and asks not to be indexed', async () => {
    const { html } = await embed(`/embed/${VIDEO_ID}`);

    const head = headOf(html);
    expect(head.match(/<link rel="stylesheet"/g)).toHaveLength(1);
    expect(head).toContain('<meta name="robots" content="noindex">');
  });

  it('answers autoplay, a start time and no controls with the page', async () => {
    const { status } = await embed(`/embed/${VIDEO_ID}?autoplay=1&t=30&controls=0&loop=1`);

    expect(status).toBe(200);
  });

  it('answers a search that does not parse by dropping it, never with an error', async () => {
    const { status, location } = await embed(
      `/embed/${VIDEO_ID}?autoplay=x&t=soon&controls=y&loop=z`
    );

    expect(status).toBe(307);
    expect(location).toBe(`/embed/${VIDEO_ID}`);
  });

  it.each([
    { scenario: 'a private video', overrides: { visibility: 'private' as const } },
    { scenario: 'a video still processing', overrides: { status: 'PROCESSING' as const } },
  ])('answers $scenario with the not-available note and no player', async ({ overrides }) => {
    const { status, html } = await embed(`/embed/${VIDEO_ID}`, overrides);

    expect(status).toBe(404);
    expect(html).toContain('This video is not available');
    expect(html).not.toContain('<img');
  });
});
