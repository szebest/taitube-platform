import { WatchPartyClientFrameSchema } from '../watch-party-socket';

const VERSIONS = { version: 4, rolesVersion: 2 };

describe('packages/api-contracts: the room socket', () => {
  it.each([
    { scenario: 'a clock ping', frame: { type: 'clock', t0: 1700 }, ok: true },
    {
      scenario: 'a pause with its versions',
      frame: { type: 'pause', positionMs: 12_000, ...VERSIONS },
      ok: true,
    },
    { scenario: 'a pause without them', frame: { type: 'pause', positionMs: 12_000 }, ok: false },
    { scenario: 'a rate off the list', frame: { type: 'rate', rate: 3, ...VERSIONS }, ok: false },
    { scenario: 'a reaction from the palette', frame: { type: 'react', emoji: '🔥' }, ok: true },
    { scenario: 'a reaction off the palette', frame: { type: 'react', emoji: '🍕' }, ok: false },
    {
      scenario: 'a seek request',
      frame: { type: 'request', kind: 'seek', positionMs: 754_000 },
      ok: true,
    },
    { scenario: 'an unpin', frame: { type: 'chat.pin', id: null, ref: 'r1' }, ok: true },
    { scenario: 'an unknown frame', frame: { type: 'ban', memberKey: 'user:x' }, ok: false },
  ])('reads $scenario: $ok', ({ frame, ok }) => {
    expect(WatchPartyClientFrameSchema.safeParse(frame).success).toBe(ok);
  });
});
