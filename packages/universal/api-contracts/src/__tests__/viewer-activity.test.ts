import { listLikedVideos, listMyComments } from '../viewer-activity';

describe('packages/api-contracts: viewer activity', () => {
  it.each([
    { endpoint: listLikedVideos, path: '/v1/me/liked-videos' },
    { endpoint: listMyComments, path: '/v1/me/comments' },
  ])('serves GET $path, keyset-paged', ({ endpoint, path }) => {
    expect(endpoint).toMatchObject({ method: 'GET', path, status: 200 });
    expect(endpoint.query.safeParse({ cursor: 'abc', limit: '5' }).success).toBe(true);
    expect(endpoint.query.safeParse({ limit: '0' }).success).toBe(false);
  });
});
