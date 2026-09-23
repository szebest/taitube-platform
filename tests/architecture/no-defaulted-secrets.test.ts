import { productionSources, read } from './repo-files';

const SECRET = /(TOKEN|SECRET|PASSWORD|ACCESS_KEY)/;

function defaultedSecrets(schemaSource: string): string[] {
  return [...schemaSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):(.*)$/gm)]
    .filter((m) => SECRET.test(m[1] as string) && /\.default\(/.test(m[2] as string))
    .map((m) => m[1] as string);
}

function literalFallbacks(source: string): string[] {
  const read = /process\.env(?:\.(\w+)|\[\s*['"](\w+)['"]\s*\])\s*(?:\|\||\?\?)\s*(['"`])[^'"`]/g;
  return [...source.matchAll(read)]
    .map((m) => (m[1] ?? m[2]) as string)
    .filter((key) => SECRET.test(key));
}

describe('architecture: no secret has a value nobody chose', () => {
  it('recognises a defaulted secret in the schema and a literal fallback in source', () => {
    expect(
      defaultedSecrets("  ADMIN_TOKEN: z.string().default('change-me-32-bytes-random'),")
    ).toEqual(['ADMIN_TOKEN']);
    expect(
      literalFallbacks("const t = process.env.ADMIN_TOKEN || 'change-me-32-bytes-random';")
    ).toEqual(['ADMIN_TOKEN']);
  });

  it('gives no secret-shaped key a default in the environment schema', () => {
    expect(defaultedSecrets(read('packages/server/env-schema/src/app-env.ts'))).toEqual([]);
  });

  it('holds no literal fallback for a secret in production source', () => {
    const offenders = productionSources().flatMap((file) =>
      literalFallbacks(read(file)).map((key) => `${file}: ${key}`)
    );

    expect(offenders).toEqual([]);
  });
});
