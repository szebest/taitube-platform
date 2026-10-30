import { getChannelFeatured, setChannelFeatured } from '../channel-featured';

const ID = '00000000-0000-7000-8000-0000000000a1';

describe('packages/api-contracts: channel featured', () => {
  it.each([
    { endpoint: getChannelFeatured, method: 'GET', path: '/v1/channels/:idOrHandle/featured' },
    { endpoint: setChannelFeatured, method: 'PUT', path: '/v1/me/channel/featured' },
  ])('serves $method $path with 200', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path, status: 200 });
  });

  it('reads the shelf without a sign-in', () => {
    expect(getChannelFeatured.anonymous).toBe(true);
  });

  it.each([
    { scenario: 'no videos', body: { videoIds: [] }, ok: true },
    { scenario: 'two videos', body: { videoIds: [ID, ID.replace(/a1$/, 'a2')] }, ok: true },
    { scenario: 'a text id', body: { videoIds: ['nope'] }, ok: false },
    { scenario: 'a missing list', body: {}, ok: false },
    { scenario: 'a single id', body: { videoIds: ID }, ok: false },
  ])('checks the body shape of $scenario', ({ body, ok }) => {
    expect(setChannelFeatured.body.safeParse(body).success).toBe(ok);
  });

  it('leaves the count and the duplicates to the rules, which name them', () => {
    const seven = Array.from({ length: 7 }, () => ID);

    expect(setChannelFeatured.body.safeParse({ videoIds: seven }).success).toBe(true);
  });

  it('takes a channel id or a handle', () => {
    expect(getChannelFeatured.params.safeParse({ idOrHandle: '@owner' }).success).toBe(true);
  });
});
