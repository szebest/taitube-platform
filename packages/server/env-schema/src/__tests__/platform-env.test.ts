import { readFileSync } from 'node:fs';
import { AppEnvSchema } from '../app-env';

const PLATFORM_ENV: Record<string, string> = JSON.parse(
  readFileSync(new URL('../platform-env.json', import.meta.url), 'utf8')
);

describe('packages/env-schema: platform-env.json', () => {
  it('names a consumer for every key', () => {
    expect(Object.values(PLATFORM_ENV).filter((consumer) => consumer.trim() === '')).toEqual([]);
  });

  it('shares no key with the schema toAppConfig reads', () => {
    expect(
      Object.keys(PLATFORM_ENV).filter((key) => Object.hasOwn(AppEnvSchema.innerType().shape, key))
    ).toEqual([]);
  });
});
