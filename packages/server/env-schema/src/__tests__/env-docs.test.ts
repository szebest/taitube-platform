import { AppEnvSchema } from '../app-env';
import { ENV_GROUPS } from '../env-doc';
import { ENV_DOCS } from '../env-docs';
import { describeEnvKey } from '../env-introspection';
import { SECRET_KEYS } from '../secret-keys';

const entries = Object.entries(ENV_DOCS);

describe('packages/env-schema: env-docs', () => {
  it('documents exactly the keys the schema declares', () => {
    expect(Object.keys(ENV_DOCS).sort()).toEqual(Object.keys(AppEnvSchema.shape).sort());
  });

  it.each(entries)('%s says what it does, gives an example and names a reader', (_key, doc) => {
    expect(doc.description.trim()).not.toBe('');
    expect(doc.example.trim()).not.toBe('');
    expect(doc.readBy.length).toBeGreaterThan(0);
    expect(ENV_GROUPS.map(({ id }) => id)).toContain(doc.group);
  });

  it.each(entries.filter(([, doc]) => doc.visibility === 'secret'))(
    'shows %s as a placeholder, never a value',
    (_key, doc) => {
      expect(doc.example).toMatch(/<[^>]+>/);
    }
  );

  it.each(SECRET_KEYS)('marks %s secret and required in production', (key) => {
    expect(ENV_DOCS[key].visibility).toBe('secret');
    expect(ENV_DOCS[key].requiredIn).toContain('production');
  });

  it('marks a key required always exactly when the schema fails without it', () => {
    const always = entries
      .filter(([, doc]) => doc.requiredIn?.includes('always'))
      .map(([key]) => key);
    const required = Object.keys(ENV_DOCS).filter(
      (key) => describeEnvKey(key as keyof typeof ENV_DOCS).default.kind === 'required'
    );

    expect(always.sort()).toEqual(required.sort());
  });
});
