import { ErrorCodes } from '@vp/errors';
import { buildWatchPartyApp, type WatchPartyApp } from './watch-party-app';

describe('GET /v1/watch-parties', () => {
  let world: WatchPartyApp;

  beforeEach(async () => {
    world = await buildWatchPartyApp({ watchParties: { maxOpenPerUser: 20 } });
  });

  afterEach(async () => {
    await world.app.close();
  });

  it('lists public rooms to a signed-out caller and leaves unlisted ones out', async () => {
    const listed = await world.createRoom('owner', { visibility: 'public', name: 'Open house' });
    await world.createRoom('owner', { visibility: 'unlisted', name: 'By link' });

    const res = await world.call('anonymous', 'GET', '/v1/watch-parties');

    expect(res.statusCode).toBe(200);
    expect(res.json().items.map(({ id }: { id: string }) => id)).toEqual([listed.id]);
  });

  it.each([
    {
      scenario: 'a cursor that is not one',
      query: '?cursor=nope',
      code: ErrorCodes.INVALID_CURSOR,
    },
    {
      scenario: 'a status it does not know',
      query: '?status=soon',
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('answers 400 for $scenario', async ({ query, code }) => {
    const res = await world.call('anonymous', 'GET', `/v1/watch-parties${query}`);

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe(code);
  });

  it('refuses the 61st request of a minute with 429', async () => {
    for (let n = 0; n < 60; n += 1) {
      expect((await world.call('anonymous', 'GET', '/v1/watch-parties')).statusCode).toBe(200);
    }

    const res = await world.call('anonymous', 'GET', '/v1/watch-parties');

    expect(res.statusCode).toBe(429);
  });
});
