import { authorizeLiveIngest } from '../live-ingest';

describe('packages/api-contracts: live ingest', () => {
  it('answers MediaMTX on the internal path with no content', () => {
    expect(authorizeLiveIngest).toMatchObject({
      method: 'POST',
      path: '/v1/internal/live/auth',
      status: 204,
      anonymous: true,
    });
  });

  it('reads a MediaMTX call, filling what it leaves out', () => {
    const parsed = authorizeLiveIngest.body.parse({ action: 'publish', path: 'live/k', id: null });

    expect(parsed).toMatchObject({ action: 'publish', path: 'live/k', user: '', password: '' });
  });

  it('refuses a call without an action', () => {
    expect(authorizeLiveIngest.body.safeParse({ path: 'live/k' }).success).toBe(false);
  });
});
