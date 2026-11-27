import {
  getOwnRestriction,
  liftRestriction,
  listRestrictions,
  RestrictionActionSchema,
  restrictUser,
} from '../channel-restrictions';

describe('packages/api-contracts: channel restrictions', () => {
  it.each([
    { endpoint: listRestrictions, method: 'GET', path: '/v1/me/channel/restrictions' },
    { endpoint: restrictUser, method: 'PUT', path: '/v1/me/channel/restrictions/:userId' },
    { endpoint: liftRestriction, method: 'DELETE', path: '/v1/me/channel/restrictions/:userId' },
    { endpoint: getOwnRestriction, method: 'GET', path: '/v1/channels/:id/me/restriction' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([
    { action: 'shadow_ban' },
    { action: 'ban' },
    { action: 'ban', reason: 'spam', expiresAt: '2026-03-02T12:00:00.000Z' },
    { action: 'ban', expiresAt: null },
  ])('accepts the action %o', (body) => {
    expect(RestrictionActionSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    {},
    { action: 'lift' },
    { action: 'ban', reason: 'x'.repeat(201) },
    { action: 'ban', expiresAt: 'tomorrow' },
  ])('refuses the action %o', (body) => {
    expect(RestrictionActionSchema.safeParse(body).success).toBe(false);
  });

  it('serves the own ban to the composer as not found for no ban', () => {
    expect(getOwnRestriction.errors[404]).toContain('RESTRICTION_NOT_FOUND');
  });
});
