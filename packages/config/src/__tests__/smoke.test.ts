import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AppEnvSchema, PostgresEnvSchema, loadEnv } from '../index.js';

describe('@vp/config test suite (AC 5)', () => {
  it('loadEnv() with missing DATABASE_URL exits 1 listing every invalid key, secrets redacted', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as typeof process.exit);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      loadEnv({
        // DATABASE_URL omitted
        ADMIN_TOKEN: 'super-secret-token',
      });
    }).toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const errorMessage = errorSpy.mock.calls[0]?.[0] as string;
    expect(errorMessage).toContain('DATABASE_URL');
    expect(errorMessage).toContain('details redacted');
    // Ensure sensitive token value is NEVER leaked into the console output
    expect(errorMessage).not.toContain('super-secret-token');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('.env.example round-trips through the schema with zero unknown keys (drift guard test)', () => {
    const envExamplePath = path.resolve(__dirname, '../../../../.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf8');
    const parsedExampleEnv: Record<string, string> = {};

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      // Skip blank lines and pure comment lines
      if (!line || line.startsWith('#')) continue;

      const equalIdx = line.indexOf('=');
      if (equalIdx === -1) continue;

      const key = line.slice(0, equalIdx).trim();
      let value = line.slice(equalIdx + 1).trim();

      // Strip inline comments if present (e.g. `value # comment` or `value # 🔒 comment`)
      // But preserve values that don't have comments
      const commentIdx = value.indexOf('#');
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }

      parsedExampleEnv[key] = value;
    }

    // Verify all keys in .env.example are recognized by AppEnvSchema
    const schemaShape = AppEnvSchema.shape;
    const schemaKeys = new Set(Object.keys(schemaShape));

    for (const key of Object.keys(parsedExampleEnv)) {
      expect(
        schemaKeys.has(key),
        `Key "${key}" found in .env.example but not in AppEnvSchema (drift detected)`
      ).toBe(true);
    }

    // Verify all keys in AppEnvSchema are present in .env.example
    for (const key of schemaKeys) {
      expect(
        key in parsedExampleEnv,
        `Key "${key}" in AppEnvSchema missing from .env.example (drift detected)`
      ).toBe(true);
    }

    // Parse .env.example through AppEnvSchema — must validate cleanly
    const validated = AppEnvSchema.parse(parsedExampleEnv);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.DATABASE_URL).toContain('postgres://');
    expect(validated.REDIS_URL).toContain('redis://');
    expect(validated.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(validated.PORT).toBe(3000);
    expect(validated.METRICS_PORT).toBe(9464);
  });

  it('validates postgres schema', () => {
    const pg = PostgresEnvSchema.parse({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
    });
    expect(pg.DATABASE_POOL_MAX).toBe(10);
  });

  it('AC 22: unmodified .env.example defaults are 100% all-local and valid for API and Worker boot', () => {
    const envExamplePath = path.resolve(__dirname, '../../../../.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf8');
    const parsedExampleEnv: Record<string, string> = {};

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const equalIdx = line.indexOf('=');
      if (equalIdx === -1) continue;
      const key = line.slice(0, equalIdx).trim();
      let value = line.slice(equalIdx + 1).trim();
      const commentIdx = value.indexOf('#');
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
      parsedExampleEnv[key] = value;
    }

    const validated = AppEnvSchema.parse(parsedExampleEnv);

    // Verify all endpoints are local
    expect(validated.DATABASE_URL).toContain('localhost');
    expect(validated.REDIS_URL).toContain('localhost');
    expect(validated.S3_ENDPOINT).toContain('localhost');
    expect(validated.CDN_BASE_URL).toContain('localhost');
    expect(validated.PUBLIC_API_URL).toContain('localhost');

    // Telemetry strictly disabled
    expect(validated.TURBO_TELEMETRY_DISABLED).toBe('1');
    expect(validated.DO_NOT_TRACK).toBe('1');

    // Zero cloud endpoints
    for (const val of Object.values(parsedExampleEnv)) {
      expect(val).not.toMatch(/r2\.cloudflarestorage\.com/);
      expect(val).not.toMatch(/neon\.tech/);
      expect(val).not.toMatch(/grafana\.net/);
    }
  });
});
