import { getLiveOverlay, getLiveStream, listLiveStreams } from '../live';

describe('packages/api-contracts: live', () => {
  it.each([
    { endpoint: listLiveStreams, path: '/v1/live' },
    { endpoint: getLiveStream, path: '/v1/live/:id' },
    { endpoint: getLiveOverlay, path: '/v1/live/overlay/:token' },
  ])('serves GET $path to anyone', ({ endpoint, path }) => {
    expect(endpoint).toMatchObject({ method: 'GET', path, status: 200, anonymous: true });
  });

  it.each([
    { scenario: 'no limit', query: undefined, ok: true },
    { scenario: 'a limit of 48', query: { limit: '48' }, ok: true },
    { scenario: 'a limit of 49', query: { limit: '49' }, ok: false },
  ])('lists with $scenario: $ok', ({ query, ok }) => {
    expect(listLiveStreams.query.safeParse(query).success).toBe(ok);
  });
});
