import { jsonResponse, recordRequests } from '../../__tests__/api-store';
import { VIDEO_ID, video } from '../../__tests__/fixtures';
import { serverRender } from '../../__tests__/server-render';

describe('apps/web: /watch/$videoId', () => {
  it('server-renders the video title, with the poster standing in for the player', async () => {
    const sent = recordRequests(() =>
      jsonResponse(
        video({
          title: 'Launch day',
          posterUrl: 'http://localhost:9000/posters/p.jpg',
          playbackUrl: 'http://localhost:9000/hls/master.m3u8',
        })
      )
    );

    const { status, html } = await serverRender(`/watch/${VIDEO_ID}`);

    expect(status).toBe(200);
    expect(html).toContain('<title>Launch day</title>');
    expect(html).toMatch(/<h4[^>]*>Launch day<\/h4>/);
    expect(html).toContain('src="http://localhost:9000/posters/p.jpg"');
    expect(html).not.toContain('<video');
    expect(sent.filter(({ url }) => url.endsWith(`/v1/videos/${VIDEO_ID}`))).toHaveLength(1);
  });

  it('renders not-found for an id that is not a video id, without asking the API', async () => {
    const sent = recordRequests();

    const { status, html } = await serverRender('/watch/not-a-video');

    expect(status).toBe(404);
    expect(html).toContain('This page does not exist.');
    expect(sent).toEqual([]);
  });

  it('renders not-found when the API has no such video', async () => {
    recordRequests(
      () =>
        new Response(
          JSON.stringify({
            type: 'about:blank',
            title: 'x',
            status: 404,
            code: 'VIDEO_NOT_FOUND',
            detail: 'x',
          }),
          { status: 404, headers: { 'content-type': 'application/problem+json' } }
        )
    );

    const { status, html } = await serverRender(`/watch/${VIDEO_ID}`);

    expect(status).toBe(404);
    expect(html).toContain('This page does not exist.');
  });
});
