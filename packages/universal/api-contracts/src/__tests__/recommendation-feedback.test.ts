import {
  listRecommendationFeedback,
  putRecommendationFeedback,
  removeRecommendationFeedback,
} from '../recommendation-feedback';

const ID = '00000000-0000-7000-8000-0000000000f1';

describe('packages/api-contracts: recommendation feedback', () => {
  it.each([
    {
      endpoint: putRecommendationFeedback,
      method: 'PUT',
      path: '/v1/me/recommendation-feedback',
      status: 200,
    },
    {
      endpoint: removeRecommendationFeedback,
      method: 'DELETE',
      path: '/v1/me/recommendation-feedback/:id',
      status: 204,
    },
    {
      endpoint: listRecommendationFeedback,
      method: 'GET',
      path: '/v1/me/recommendation-feedback',
      status: 200,
    },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { scenario: 'a video', body: { kind: 'not_interested', videoId: ID }, ok: true },
    { scenario: 'a channel', body: { kind: 'hide_channel', channelId: ID }, ok: true },
    {
      scenario: 'a video with a channel id',
      body: { kind: 'not_interested', channelId: ID },
      ok: false,
    },
    {
      scenario: 'a channel with a video id',
      body: { kind: 'hide_channel', videoId: ID },
      ok: false,
    },
    { scenario: 'an unknown kind', body: { kind: 'dislike', videoId: ID }, ok: false },
    {
      scenario: 'an id that is not a UUID',
      body: { kind: 'hide_channel', channelId: 'x' },
      ok: false,
    },
  ])('puts $scenario: $ok', ({ body, ok }) => {
    expect(putRecommendationFeedback.body.safeParse(body).success).toBe(ok);
  });

  it('refuses an id that is not a UUID', () => {
    expect(removeRecommendationFeedback.params.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it.each([
    { scenario: 'a cursor and a limit', query: { cursor: 'abc', limit: '5' }, ok: true },
    { scenario: 'a kind', query: { kind: 'hide_channel' }, ok: true },
    { scenario: 'an unknown kind', query: { kind: 'dislike' }, ok: false },
  ])('lists with $scenario: $ok', ({ query, ok }) => {
    expect(listRecommendationFeedback.query.safeParse(query).success).toBe(ok);
  });
});
