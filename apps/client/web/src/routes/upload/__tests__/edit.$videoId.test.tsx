import { VIDEO_ID } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/web: /upload/edit/$videoId', () => {
  it.each([
    { segment: 'a video id', videoId: VIDEO_ID },
    { segment: 'a segment that is not a video id, which the studio answers', videoId: 'nope' },
  ])('sends the creator to the same path on the studio for $segment', async ({ videoId }) => {
    const rendered = await serverRender(getRouter, `/upload/edit/${videoId}`);

    expect(rendered.status).toBe(307);
    expect(rendered.location).toBe(`http://localhost:5174/upload/edit/${videoId}`);
  });
});
