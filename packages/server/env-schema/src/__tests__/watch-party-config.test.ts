import { watchPartyConfig } from '../watch-party-config';

describe('packages/env-schema: watch party config', () => {
  it('keeps the three keys beside the tuning, with passwords hashed at the production cost', () => {
    const keys = { maxMembers: 200, maxOpenPerUser: 3, guestSalt: undefined };

    expect(watchPartyConfig(keys)).toMatchObject({
      ...keys,
      ticketTtlSeconds: 30,
      scrypt: { N: 32768, r: 8, p: 1 },
    });
  });
});
