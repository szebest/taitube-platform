import { ALL_ROUTES, parseContractRoutes } from '../openapi-routes';

const DOCUMENT = `openapi: 3.1.0
paths:
  /healthz:
    get:
      summary: Liveness probe
  /v1/videos/{id}/comments:
    get:
      tags:
        - Comments
    post:
      summary: Comment
  /v1/me/channel/images/{kind}/upload:
    post:
      summary: Prepare
components:
  schemas:
    /v1/not/a/path:
      get:
        summary: nope
`;

describe('seed/openapi-routes: parseContractRoutes', () => {
  const routes = parseContractRoutes(DOCUMENT);

  it.each([
    ['GET /healthz', true],
    ['POST /v1/videos/{id}/comments', true],
    ['POST /v1/videos/{videoId}/comments', true],
    ['POST /v1/videos/:id/comments', true],
    ['POST /v1/me/channel/images/{kind}/upload', true],
    ['DELETE /v1/videos/{id}/comments', false],
    ['GET /v1/playlists', false],
    ['GET /v1/not/a/path', false],
  ])('answers %s with %s', (route, present) => {
    expect(routes.has(route)).toBe(present);
  });

  it('lists nothing for a document without paths', () => {
    expect(parseContractRoutes('openapi: 3.1.0\n').has('GET /healthz')).toBe(false);
  });

  it('has an index that knows every route for the case where the contract cannot be read', () => {
    expect(ALL_ROUTES.has('GET /anything')).toBe(true);
  });
});
