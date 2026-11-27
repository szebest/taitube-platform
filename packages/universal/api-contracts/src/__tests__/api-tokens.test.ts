import { API_SCOPES } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { createApiToken, listApiTokens, revokeApiToken } from '../api-tokens';
import { isEndpoint } from '../endpoint';
import { contracts, endpointKey } from '../index';

const VIEW = {
  id: '00000000-0000-7000-8000-00000000000a',
  name: 'nightly views',
  prefix: '0a1b2c3d',
  channelId: '00000000-0000-7000-8000-00000000000c',
  scopes: ['analytics:read'],
  expiresAt: '2026-05-30T12:00:00.000Z',
  lastUsedAt: null,
  requestsToday: 0,
  status: 'active',
  createdAt: '2026-03-01T12:00:00.000Z',
};

function scopedRoutes(): Record<string, string> {
  return Object.fromEntries(
    Object.values(contracts)
      .flatMap((group) => Object.values(group).filter(isEndpoint))
      .flatMap((endpoint) =>
        endpoint.scope ? [[endpointKey(endpoint.method, endpoint.path), endpoint.scope]] : []
      )
  );
}

describe('packages/api-contracts: api tokens', () => {
  it.each([
    { endpoint: createApiToken, method: 'POST', path: '/v1/me/api-tokens', status: 201 },
    { endpoint: listApiTokens, method: 'GET', path: '/v1/me/api-tokens', status: 200 },
    { endpoint: revokeApiToken, method: 'DELETE', path: '/v1/me/api-tokens/:id', status: 204 },
  ])('serves $method $path with $status and no scope', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
    expect(endpoint).not.toHaveProperty('scope');
  });

  it('refuses the eleventh active token with 409', () => {
    expect(createApiToken.errors).toMatchObject({ 409: [ErrorCodes.API_TOKEN_LIMIT_REACHED] });
  });

  it.each([
    { scenario: 'a name and a scope', body: { name: 'n', scopes: ['videos:read'] }, ok: true },
    {
      scenario: 'every scope and a year',
      body: { name: 'n', scopes: [...API_SCOPES], expiry: '1y' },
      ok: true,
    },
    { scenario: 'no scope', body: { name: 'n', scopes: [] }, ok: false },
    { scenario: 'an unknown scope', body: { name: 'n', scopes: ['posts:publish'] }, ok: false },
    { scenario: 'a blank name', body: { name: '   ', scopes: ['videos:read'] }, ok: false },
    {
      scenario: 'a 61 character name',
      body: { name: 'a'.repeat(61), scopes: ['videos:read'] },
      ok: false,
    },
    {
      scenario: 'no expiry limit',
      body: { name: 'n', scopes: ['videos:read'], expiry: 'never' },
      ok: false,
    },
  ])('checks the create body of $scenario', ({ body, ok }) => {
    expect(createApiToken.body.safeParse(body).success).toBe(ok);
  });

  it('expires a token in 90 days unless told otherwise', () => {
    expect(createApiToken.body.parse({ name: 'n', scopes: ['videos:read'] }).expiry).toBe('90d');
  });

  it('shows the token on the created one only', () => {
    expect(createApiToken.result.safeParse({ ...VIEW, token: 'tt_pat_x' }).success).toBe(true);
    expect(createApiToken.result.safeParse(VIEW).success).toBe(false);
    expect(listApiTokens.result.parse({ items: [{ ...VIEW, token: 'tt_pat_x' }] })).toEqual({
      items: [VIEW],
    });
  });

  it('names the scope of every route a token can call, and no other route', () => {
    expect(scopedRoutes()).toEqual({
      'GET /v1/videos': 'videos:read',
      'GET /v1/videos/:id': 'videos:read',
      'PATCH /v1/videos/:id': 'videos:write',
      'GET /v1/creator/videos': 'videos:write',
      'PATCH /v1/creator/videos/:id': 'videos:write',
      'POST /v1/creator/videos/bulk': 'videos:write',
      'GET /v1/creator/videos/:id/revisions': 'videos:write',
      'POST /v1/creator/videos/:id/revisions/:revisionId/restore': 'videos:write',
      'GET /v1/creator/videos/:id/chapter-suggestions': 'videos:write',
      'PUT /v1/videos/:id/chapters': 'videos:write',
      'GET /v1/videos/:id/corrections': 'videos:read',
      'POST /v1/videos/:id/corrections': 'videos:write',
      'PATCH /v1/videos/:id/corrections/:correctionId': 'videos:write',
      'DELETE /v1/videos/:id/corrections/:correctionId': 'videos:write',
      'GET /v1/creator/videos/:id/share-links': 'videos:write',
      'POST /v1/creator/videos/:id/share-links': 'videos:write',
      'DELETE /v1/creator/videos/:id/share-links/:linkId': 'videos:write',
      'PUT /v1/creator/videos/:id/password': 'videos:write',
      'DELETE /v1/creator/videos/:id/password': 'videos:write',
      'POST /v1/videos/:id/unlock': 'videos:read',
      'GET /v1/creator/videos/:id/experiments': 'videos:write',
      'POST /v1/creator/videos/:id/experiments': 'videos:write',
      'POST /v1/creator/videos/:id/experiments/:experimentId/stop': 'videos:write',
      'POST /v1/creator/videos/:id/experiments/:experimentId/apply': 'videos:write',
      'GET /v1/creator/videos/:id/generations': 'videos:write',
      'POST /v1/videos/:id/replacement': 'videos:write',
      'POST /v1/videos/:id/replacement/complete': 'videos:write',
      'PUT /v1/videos/:id/edits': 'videos:write',
      'POST /v1/videos/:id/edits/revert': 'videos:write',
      'GET /v1/creator/videos/:id/clip-suggestions': 'videos:write',
      'GET /v1/creator/videos/:id/analytics': 'analytics:read',
      'GET /v1/creator/videos/:id/retention': 'analytics:read',
      'GET /v1/creator/videos/:id/audience': 'analytics:read',
      'GET /v1/creator/videos/:id/benchmark': 'analytics:read',
      'GET /v1/creator/channel/analytics': 'analytics:read',
      'GET /v1/videos/:id/comments': 'comments:read',
      'GET /v1/comments/:id/replies': 'comments:read',
      'GET /v1/creator/comments': 'comments:moderate',
      'POST /v1/creator/comments/bulk': 'comments:moderate',
      'POST /v1/comments/:id/moderate': 'comments:moderate',
      'DELETE /v1/comments/:id': 'comments:moderate',
      'GET /v1/posts/:id/comments': 'comments:read',
      'GET /v1/threads/:id': 'comments:read',
      'GET /v1/threads/:id/comments': 'comments:read',
      'GET /v1/videos/:id/threads': 'comments:read',
      'POST /v1/threads/:id/remove': 'comments:moderate',
      'POST /v1/me/channel/posts': 'posts:write',
      'PATCH /v1/me/channel/posts/:id': 'posts:write',
      'DELETE /v1/me/channel/posts/:id': 'posts:write',
      'POST /v1/me/channel/posts/:id/pin': 'posts:write',
      'DELETE /v1/me/channel/posts/:id/pin': 'posts:write',
      'GET /v1/me/channel/posts/:id/revisions': 'posts:write',
      'POST /v1/me/channel/posts/:id/revisions/:revisionId/restore': 'posts:write',
      'POST /v1/me/channel/exports': 'exports:create',
      'GET /v1/me/channel/exports': 'exports:read',
      'GET /v1/me/channel/exports/:id': 'exports:read',
      'DELETE /v1/me/channel/exports/:id': 'exports:create',
      'POST /v1/me/webhooks': 'webhooks:manage',
      'POST /v1/me/webhooks/:id/test': 'webhooks:manage',
      'GET /v1/me/webhooks': 'webhooks:manage',
      'DELETE /v1/me/webhooks/:id': 'webhooks:manage',
    });
  });

  it('gives every scope at least one route', () => {
    expect(new Set(Object.values(scopedRoutes()))).toEqual(new Set(API_SCOPES));
  });
});
