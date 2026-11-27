import { readFileSync } from 'node:fs';
import { AppEnvSchema } from '../app-env';
import { EXTRA_ENV_DOCS, EXTRA_GROUPS } from '../env-docs-extra';

const PLATFORM_ENV: Record<string, string> = JSON.parse(
  readFileSync(new URL('../platform-env.json', import.meta.url), 'utf8')
);

describe('packages/env-schema: env-docs-extra', () => {
  it.each(Object.entries(EXTRA_ENV_DOCS))('%s is documented in full', (_key, doc) => {
    expect(doc.description.trim()).not.toBe('');
    expect(doc.example.trim()).not.toBe('');
    expect(doc.readBy.length).toBeGreaterThan(0);
    expect(EXTRA_GROUPS.map(({ id }) => id)).toContain(doc.group);
    if (doc.visibility === 'secret') expect(doc.example).toMatch(/<[^>]+>/);
  });

  it('documents every platform key', () => {
    expect(Object.keys(PLATFORM_ENV).filter((key) => !(key in EXTRA_ENV_DOCS))).toEqual([]);
  });

  it('shares no key with the schema', () => {
    expect(Object.keys(EXTRA_ENV_DOCS).filter((key) => key in AppEnvSchema.shape)).toEqual([]);
  });
});
