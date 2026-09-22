import { read, trackedFiles } from './repo-files';

const SDK = /^(@aws-sdk\/[^/'"]+|ioredis|bullmq|postgres|drizzle-orm)(\/.*)?$/;
const SPECIFIER = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;
const DRIVER_HOMES = ['packages/server/adapters/', 'packages/server/db/'];
const COMPOSITION_ROOTS = ['apps/api/src/app.ts', 'apps/worker/src/runner.ts'];

function sdkImports(file: string): string[] {
  return [...read(file).matchAll(SPECIFIER)]
    .map((match) => match[1] as string)
    .filter((specifier) => SDK.test(specifier));
}

function declaredSdks(manifest: string): string[] {
  const raw = JSON.parse(read(manifest)) as Record<string, Record<string, string> | undefined>;
  return [
    ...Object.keys(raw['dependencies'] ?? {}),
    ...Object.keys(raw['peerDependencies'] ?? {}),
    ...Object.keys(raw['devDependencies'] ?? {}),
  ].filter((name) => SDK.test(name));
}

describe('architecture: concrete driver SDKs stay behind the adapter seam', () => {
  it('still recognises the imports the adapters legitimately make', () => {
    expect(sdkImports('packages/server/adapters/redis/redis-cache-client.ts')).toContain('ioredis');
    expect(sdkImports('packages/server/db/src/client.ts')).toContain('postgres');
  });

  it('names an SDK nowhere but the adapters and the Drizzle vocabulary they query through', () => {
    const offenders = trackedFiles('apps', 'packages', 'scripts', 'tests', 'tools')
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !DRIVER_HOMES.some((home) => file.startsWith(home)))
      .flatMap((file) => sdkImports(file).map((specifier) => `${file}: '${specifier}'`));

    expect(offenders).toEqual([]);
  });

  it.each(COMPOSITION_ROOTS.map((file) => ({ file })))(
    'wires adapters in $file without naming an SDK',
    ({ file }) => {
      expect(sdkImports(file)).toEqual([]);
    }
  );

  it('links an SDK into no other workspace, so an import there cannot even resolve', () => {
    const offenders = ['package.json', ...trackedFiles('apps', 'packages')]
      .filter((file) => file.endsWith('package.json'))
      .filter((file) => !DRIVER_HOMES.some((home) => file.startsWith(home)))
      .flatMap((manifest) =>
        declaredSdks(manifest).map((name) => `${manifest}: declares '${name}'`)
      );

    expect(offenders).toEqual([]);
  });
});
