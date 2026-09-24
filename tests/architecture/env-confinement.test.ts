import { ENTRYPOINTS, ENV_HOMES, isListed } from './entrypoints';
import { isSpec, read, trackedFiles } from './repo-files';

const SCANNED = /\.(ts|tsx|mts|js|mjs)$/;

function readsEnvOutsideAHome(file: string, source: string): boolean {
  return (
    /\bprocess\.env\b/.test(source) && !isListed(file, ENTRYPOINTS) && !isListed(file, ENV_HOMES)
  );
}

function scannedSources(): string[] {
  return trackedFiles('apps', 'packages', 'scripts', 'tests')
    .filter((file) => SCANNED.test(file))
    .filter((file) => !isSpec(file) && !/\/__(tests|mocks)__\//.test(file));
}

describe('architecture: process.env is read only where a process starts', () => {
  it.each([
    { file: 'apps/api/src/services/upload-service.ts', source: "process.env['S3_BUCKET_RAW']" },
    { file: 'packages/server/db/drizzle.config.ts', source: 'process.env.DATABASE_URL' },
    { file: 'infra/compose/autoscaler.mjs', source: 'const url = process.env.REDIS_URL;' },
    { file: 'scripts/nested/tool.ts', source: 'process.env.X' },
  ])('recognises an env read in $file', ({ file, source }) => {
    expect(readsEnvOutsideAHome(file, source)).toBe(true);
  });

  it.each(['apps/api/src/main.ts', 'scripts/run-e2e.ts', 'packages/server/config/src/load-env.ts'])(
    'allows %s, which is listed in entrypoints.ts',
    (file) => {
      expect(readsEnvOutsideAHome(file, 'process.env.NODE_ENV')).toBe(false);
    }
  );

  it('scans .mjs and .js as well as TypeScript', () => {
    expect(['a.mjs', 'b.js', 'c.mts', 'd.tsx'].every((file) => SCANNED.test(file))).toBe(true);
  });

  it('finds no env read outside the entrypoints and the env homes', () => {
    const offenders = scannedSources().filter((file) => readsEnvOutsideAHome(file, read(file)));

    expect(offenders).toEqual([]);
  });

  it('lists no entrypoint or env home that does not exist', () => {
    const tracked = trackedFiles('apps', 'packages', 'scripts', 'tests');
    const missing = [...ENTRYPOINTS, ...ENV_HOMES].filter(
      (pattern) => !tracked.some((file) => isListed(file, [pattern]))
    );

    expect(missing).toEqual([]);
  });
});
