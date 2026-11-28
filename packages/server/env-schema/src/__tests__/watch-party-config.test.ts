import { watchPartyConfig } from '../watch-party-config';

describe('packages/env-schema: watch party config', () => {
  it('keeps the three keys beside the tuning, with passwords hashed at the production cost', () => {
    const config = watchPartyConfig({ maxMembers: 200, maxOpenPerUser: 3, guestSalt: undefined });

    expect(config).toMatchObject({
      maxMembers: 200,
      maxOpenPerUser: 3,
      guestSalt: undefined,
      ticketTtlSeconds: 30,
      scrypt: { N: 131072, r: 8, p: 1 },
    });
  });
});
