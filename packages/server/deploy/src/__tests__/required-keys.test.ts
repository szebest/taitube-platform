import { consistencyFindings, requiredKeys } from '../required-keys';
import { DOCS, PRODUCTION, PREVIEW } from './fixtures';

const FILE = 'infra/environments/production/environment.yaml';

describe('requiredKeys', () => {
  it.each([
    {
      scenario: 'a production environment on jwks auth',
      env: PRODUCTION,
      expected: {
        secrets: ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
        config: ['AUTH_JWKS_URL'],
      },
    },
    {
      scenario: 'a production environment on dev auth',
      env: { ...PRODUCTION, config: { AUTH_MODE: 'dev' } },
      expected: {
        secrets: ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
        config: [],
      },
    },
    {
      scenario: 'an environment that is not production',
      env: PREVIEW,
      expected: { secrets: [], config: [] },
    },
  ])('reads the registry for $scenario', ({ env, expected }) => {
    expect(requiredKeys(env, DOCS)).toEqual(expected);
  });
});

describe('consistencyFindings', () => {
  it('has none for an environment that lists everything production requires', () => {
    expect(consistencyFindings(PRODUCTION, DOCS, FILE)).toEqual([]);
  });

  it.each([
    {
      scenario: 'a required secret missing from secrets.keys',
      env: {
        ...PRODUCTION,
        secrets: {
          ...PRODUCTION.secrets,
          keys: ['DATABASE_URL', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
        },
      },
      expected: `production: REDIS_PASSWORD is a secret a production boot requires: add it to secrets.keys in ${FILE}`,
    },
    {
      scenario: 'a required public key not set',
      env: { ...PRODUCTION, config: {} },
      expected: `production: AUTH_JWKS_URL is required in production: set it under config (or secrets.keys) in ${FILE}`,
    },
    {
      scenario: 'a key neither the schema nor the extras document',
      env: { ...PRODUCTION, config: { ...PRODUCTION.config, MADE_UP: '1' } },
      expected: `production: MADE_UP is in neither the env schema nor EXTRA_ENV_DOCS: fix the name in ${FILE} or document the key`,
    },
  ])('names $scenario and the file to edit', ({ env, expected }) => {
    expect(consistencyFindings(env, DOCS, FILE)).toEqual([expected]);
  });
});
