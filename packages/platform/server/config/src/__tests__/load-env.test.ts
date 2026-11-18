import { expectErr } from '@vp/testing/result';
import { z } from 'zod';
import { loadEnv, parseEnv } from '../load-env';

const Schema = z.object({
  DATABASE_URL: z.url(),
  ADMIN_TOKEN: z.string().min(12).optional(),
  PORT: z.coerce.number().int().default(3000),
});

const VALID_ENV = { DATABASE_URL: 'postgres://localhost:5432/vp' };

function captureFailure(env: Record<string, string>): string {
  return expectErr(parseEnv(Schema, env)).issues.join('\n');
}

describe('packages/config: loadEnv', () => {
  it('reports every invalid key and redacts the sensitive ones', () => {
    const message = captureFailure({ ADMIN_TOKEN: 'short', PORT: 'eighty' });

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT: ');
    expect(message).toContain('details redacted');
    expect(message).not.toContain('short');
  });

  it('redacts a URL whose value is invalid', () => {
    expect(captureFailure({ DATABASE_URL: 'not-a-url' })).toMatch(
      /^DATABASE_URL: .* \(sensitive key - details redacted\)$/
    );
  });

  it('returns the parsed value, defaults applied', () => {
    expect(loadEnv(Schema, VALID_ENV)).toEqual({ ...VALID_ENV, PORT: 3000 });
  });

  it('throws the same report, one key a line, for an entrypoint to log', () => {
    expect(() => loadEnv(Schema, {})).toThrow(
      /^\[FATAL\] Invalid environment configuration:\n {2}- DATABASE_URL: .*details redacted/
    );
  });

  it('reads process.env when it is handed no record', () => {
    const previous = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = VALID_ENV.DATABASE_URL;
    try {
      expect(loadEnv(Schema).DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    } finally {
      if (previous === undefined) delete process.env['DATABASE_URL'];
      else process.env['DATABASE_URL'] = previous;
    }
  });
});
