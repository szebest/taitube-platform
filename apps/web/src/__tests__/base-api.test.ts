import { ApiError } from '@vp/api-client';
import { runApiQuery, toQueryError } from '../base-api';

describe('apps/web: api query', () => {
  it('unwraps a successful call', async () => {
    await expect(runApiQuery(async () => ({ ok: true }))).resolves.toEqual({ data: { ok: true } });
  });

  it('turns an ApiError into the status and code a component can branch on', async () => {
    const result = await runApiQuery(async () => {
      throw new ApiError(409, 'VERSION_CONFLICT', 'Stale version');
    });

    expect(result).toEqual({
      error: { status: 409, code: 'VERSION_CONFLICT', message: 'Stale version' },
    });
  });

  it('reports a transport failure as status 0 rather than swallowing it', () => {
    expect(toQueryError(new TypeError('Failed to fetch'))).toEqual({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Failed to fetch',
    });
  });
});
