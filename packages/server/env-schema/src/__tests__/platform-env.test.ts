import { AppEnvSchema } from '../app-env';
import { PLATFORM_ENV } from '../platform-env';

describe('packages/env-schema: PLATFORM_ENV', () => {
  it('names a consumer for every key', () => {
    expect(Object.values(PLATFORM_ENV).filter((consumer) => consumer.trim() === '')).toEqual([]);
  });

  it('shares no key with the schema toAppConfig reads', () => {
    expect(
      Object.keys(PLATFORM_ENV).filter((key) => Object.hasOwn(AppEnvSchema.innerType().shape, key))
    ).toEqual([]);
  });
});
