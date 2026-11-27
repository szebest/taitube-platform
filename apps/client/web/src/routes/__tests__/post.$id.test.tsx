import { getPost } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { loaderApi } from '#app/__tests__/loader-api';
import { POST_ID } from '#app/__tests__/post-fixtures';
import { postsApi } from '#app/__tests__/posts-api';
import { getRouter } from '#app/router';

describe('apps/client/web: /post/$id', () => {
  it('server-renders the post the loader fetched, with no second read of it', async () => {
    const calls: string[] = [];

    const { status, main } = await serverRender(getRouter, `/post/${POST_ID}`, {
      handlers: [...postsApi({ calls }), ...loaderApi()],
    });

    expect(status).toBe(200);
    expect(main).toContain('A new episode is out');
    expect(main).toContain('Post by The Creator');
    expect(calls.filter((call) => call === `GET /v1/posts/${POST_ID}`)).toHaveLength(1);
  });

  it('renders not-found for a segment that is not a post id, without asking the API', async () => {
    const calls: string[] = [];

    const { status } = await serverRender(getRouter, '/post/not-a-post', {
      handlers: [...postsApi({ calls }), ...loaderApi()],
    });

    expect(status).toBe(404);
    expect(calls).toEqual([]);
  });

  it('renders not-found when the API has no such post', async () => {
    const { status } = await serverRender(getRouter, `/post/${POST_ID}`, {
      handlers: [mockEndpoint(getPost, () => problemReply(ErrorCodes.POST_NOT_FOUND))],
    });

    expect(status).toBe(404);
  });
});
