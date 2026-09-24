import { ApiError } from '@vp/api-client';
import { runApiQuery } from '../base-api';

describe('apps/web: api query', () => {
  it('unwraps a successful call', async () => {
    await expect(runApiQuery(async () => ({ ok: true }))).resolves.toEqual({ data: { ok: true } });
  });

  it.each([
    {
      scenario: 'an ApiError as the status and code a component can branch on',
      thrown: new ApiError(409, 'VERSION_CONFLICT', 'Stale version'),
      error: { status: 409, code: 'VERSION_CONFLICT', message: 'Stale version' },
    },
    {
      scenario: 'a transport failure as status 0',
      thrown: new TypeError('Failed to fetch'),
      error: { status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' },
    },
    {
      scenario: 'a throw that is not an Error as status 0',
      thrown: 'socket closed',
      error: { status: 0, code: 'NETWORK_ERROR', message: 'Request failed' },
    },
  ])('reports $scenario', async ({ thrown, error }) => {
    const result = await runApiQuery(async () => {
      throw thrown;
    });

    expect(result).toEqual({ error });
  });
});
