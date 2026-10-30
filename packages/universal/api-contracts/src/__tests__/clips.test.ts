import { createClip, deleteClip, getClip, listMyClips } from '../clips';

describe('packages/api-contracts: clips', () => {
  it.each([
    { endpoint: createClip, method: 'POST', path: '/v1/videos/:id/clips', status: 201 },
    { endpoint: getClip, method: 'GET', path: '/v1/clips/:id', status: 200 },
    { endpoint: listMyClips, method: 'GET', path: '/v1/me/clips', status: 200 },
    { endpoint: deleteClip, method: 'DELETE', path: '/v1/clips/:id', status: 204 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it('reads a clip without a sign-in', () => {
    expect(getClip.anonymous).toBe(true);
  });

  it.each([
    { scenario: 'a whole range', body: { startMs: 1000, endMs: 21000, title: 'x' }, ok: true },
    { scenario: 'a fractional start', body: { startMs: 1.5, endMs: 21000, title: 'x' }, ok: false },
    { scenario: 'a missing title', body: { startMs: 1000, endMs: 21000 }, ok: false },
    { scenario: 'a text range', body: { startMs: '1', endMs: 21000, title: 'x' }, ok: false },
  ])('checks the body shape of $scenario', ({ body, ok }) => {
    expect(createClip.body.safeParse(body).success).toBe(ok);
  });

  it('refuses a clip id that is not a UUID', () => {
    expect(getClip.params.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('pages with a cursor and a limit', () => {
    expect(listMyClips.query.parse({ cursor: 'abc', limit: '5' })).toEqual({
      cursor: 'abc',
      limit: 5,
    });
  });
});
