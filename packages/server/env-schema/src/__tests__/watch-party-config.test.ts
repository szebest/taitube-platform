import { AppEnvSchema } from '../app-env';
import { watchPartyConfig } from '../watch-party-config';

describe('packages/env-schema: watch party config', () => {
  it('keeps the three keys beside the tuning, with passwords hashed at the production cost', () => {
    const env = AppEnvSchema.parse({ DATABASE_URL: 'postgres://db:5432/vp' });

    expect(watchPartyConfig(env)).toMatchObject({
      maxMembers: 200,
      maxOpenPerUser: 3,
      guestSalt: undefined,
      ticketTtlSeconds: 30,
      scrypt: { N: 131072, r: 8, p: 1 },
    });
  });
});
