import { definePackageTestConfig, withEnv } from '../index';

describe('@kit/testing', () => {
  it('restores spies and stubbed env vars before every test', () => {
    const { test } = definePackageTestConfig();

    expect(test).toMatchObject({ restoreMocks: true, unstubEnvs: true });
  });

  it('keeps the defaults a package does not override', () => {
    const { test } = definePackageTestConfig({ test: { testTimeout: 60_000 } });

    expect(test).toMatchObject({ testTimeout: 60_000, restoreMocks: true, globals: true });
  });

  it('sets and unsets env vars for one call and restores them after', async () => {
    const seen = await withEnv({ ACME_SPEC_SET: 'set', PATH: undefined }, () => ({
      set: process.env.ACME_SPEC_SET,
      path: process.env.PATH,
    }));

    expect(seen).toEqual({ set: 'set', path: undefined });
    expect(process.env.ACME_SPEC_SET).toBeUndefined();
    expect(process.env.PATH).toBeDefined();
  });
});
