import { formatSecretsReport, parseEnvFile, secretsOk, secretsReport } from '../secrets-check';
import { DOCS, PREVIEW, PRODUCTION } from './fixtures';

const local = (value: string) => value === 'minioadmin';

const FILE = [
  '# the production secrets',
  'DATABASE_URL=postgres://app:s3cret@db/vp',
  'export REDIS_PASSWORD="quoted"',
  'S3_ACCESS_KEY_ID=',
  'S3_SECRET_ACCESS_KEY=minioadmin',
  'EXTRA=1',
].join('\n');

describe('parseEnvFile', () => {
  it('reads names and unquoted values, skipping comments and blank lines', () => {
    expect(parseEnvFile(FILE).get('REDIS_PASSWORD')).toBe('quoted');
    expect([...parseEnvFile(FILE).keys()]).toEqual([
      'DATABASE_URL',
      'REDIS_PASSWORD',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'EXTRA',
    ]);
  });
});

describe('secretsReport', () => {
  it('lists every expected secret as missing when there is no file', () => {
    const report = secretsReport(PRODUCTION, DOCS, undefined, local);

    expect(report.missing).toEqual(report.expected);
    expect(secretsOk(report, PRODUCTION)).toBe(false);
  });

  it('sorts a file into missing, empty, local credentials and unexpected names', () => {
    const report = secretsReport(PRODUCTION, DOCS, FILE, local);

    expect(report).toEqual({
      expected: ['DATABASE_URL', 'REDIS_PASSWORD', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
      missing: [],
      empty: ['S3_ACCESS_KEY_ID'],
      localCredentials: ['S3_SECRET_ACCESS_KEY'],
      unexpected: ['EXTRA'],
    });
  });

  it('is satisfied by a file with every secret set to a real value', () => {
    const text = PRODUCTION.secrets.keys.map((key) => `${key}=value-of-${key}`).join('\n');

    expect(secretsOk(secretsReport(PRODUCTION, DOCS, text, local), PRODUCTION)).toBe(true);
  });

  it('tolerates a local credential outside production', () => {
    const env = { ...PREVIEW, secrets: { source: 'env-file' as const, keys: ['ADMIN_TOKEN'] } };

    expect(secretsOk(secretsReport(env, DOCS, 'ADMIN_TOKEN=minioadmin', local), env)).toBe(true);
  });
});

describe('formatSecretsReport', () => {
  it('prints names and never a value', () => {
    const text = formatSecretsReport(
      PRODUCTION,
      secretsReport(PRODUCTION, DOCS, FILE, local),
      '.secrets/production.env'
    );

    expect(text).toContain('empty or placeholder: S3_ACCESS_KEY_ID');
    expect(text).toContain(
      'holds a credential this repo ships for local use: S3_SECRET_ACCESS_KEY'
    );
    expect(text).toContain('result: fix the lines above');
    expect(text).not.toMatch(/s3cret|quoted|minioadmin/);
  });
});
