import { LiveCompanionCommandSchema, liveCompanionSocket } from '../live-companion';

describe('packages/api-contracts: live companion', () => {
  it('upgrades GET /v1/live/companion to a socket', () => {
    expect(liveCompanionSocket).toMatchObject({
      method: 'GET',
      path: '/v1/live/companion',
      status: 101,
      socket: true,
    });
  });

  it.each([
    { scenario: 'a stop', command: { type: 'stop' }, ok: true },
    { scenario: 'a slow mode', command: { type: 'chat.mode', slowModeSeconds: 30 }, ok: true },
    {
      scenario: 'a slow mode past 300 s',
      command: { type: 'chat.mode', slowModeSeconds: 301 },
      ok: false,
    },
    { scenario: 'a start', command: { type: 'start' }, ok: false },
  ])('reads a companion command of $scenario: $ok', ({ command, ok }) => {
    expect(LiveCompanionCommandSchema.safeParse(command).success).toBe(ok);
  });
});
