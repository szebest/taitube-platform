import {
  appealScreening,
  approveHeldVideo,
  dismissScreeningFlags,
  getVideoScreening,
  listScreeningCases,
  rejectHeldVideo,
} from '../screening';

describe('packages/api-contracts: screening', () => {
  it.each([
    { endpoint: listScreeningCases, method: 'GET', path: '/v1/admin/screening' },
    { endpoint: approveHeldVideo, method: 'POST', path: '/v1/admin/videos/:id/screening/approve' },
    { endpoint: rejectHeldVideo, method: 'POST', path: '/v1/admin/videos/:id/screening/reject' },
    {
      endpoint: dismissScreeningFlags,
      method: 'POST',
      path: '/v1/admin/videos/:id/screening/dismiss',
    },
    { endpoint: getVideoScreening, method: 'GET', path: '/v1/creator/videos/:id/screening' },
    { endpoint: appealScreening, method: 'POST', path: '/v1/creator/videos/:id/screening/appeal' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([
    { body: { reason: 'A re-upload' }, accepted: true },
    { body: { reason: '  padded  ' }, accepted: true },
    { body: {}, accepted: false },
    { body: { reason: '   ' }, accepted: false },
    { body: { reason: 'x'.repeat(501) }, accepted: false },
  ])('judges the rejection $body as accepted: $accepted', ({ body, accepted }) => {
    expect(rejectHeldVideo.body.safeParse(body).success).toBe(accepted);
  });

  it.each([
    { body: { message: 'It is mine' }, accepted: true },
    { body: {}, accepted: false },
    { body: { message: '' }, accepted: false },
    { body: { message: 'x'.repeat(1001) }, accepted: false },
  ])('judges the appeal $body as accepted: $accepted', ({ body, accepted }) => {
    expect(appealScreening.body.safeParse(body).success).toBe(accepted);
  });

  it.each([
    { query: {}, accepted: true },
    { query: { state: 'open' }, accepted: true },
    { query: { state: 'decided', limit: '5' }, accepted: true },
    { query: { state: 'other' }, accepted: false },
  ])('judges the queue query $query as accepted: $accepted', ({ query, accepted }) => {
    expect(listScreeningCases.query.safeParse(query).success).toBe(accepted);
  });

  it('promises a conflict to a stale moderator and a refusal of a takedown appeal', () => {
    expect(approveHeldVideo.errors[409]).toContain('VERSION_CONFLICT');
    expect(appealScreening.errors[403]).toContain('FORBIDDEN');
  });
});
