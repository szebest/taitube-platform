import { existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { ROOT, read, trackedFiles } from './repo-files';

const STATIC_IMPORT = /^(?:import|export)\s+(?!type\b)[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm;
const IN_MEMORY = 'packages/server/adapters/in-memory/';

type Reader = (file: string) => string | undefined;

interface Manifest {
  name: string;
  exports?: Record<string, string | { import?: string; default?: string }>;
}

function workspaceManifests(): Map<string, { dir: string; manifest: Manifest }> {
  return new Map(
    trackedFiles('apps', 'packages')
      .filter((file) => /^(apps|packages\/\w+)\/[\w-]+\/package\.json$/.test(file))
      .map((file) => {
        const manifest = JSON.parse(read(file)) as Manifest;
        return [manifest.name, { dir: dirname(file), manifest }];
      })
  );
}

function sourceOf(dir: string, built: string, reader: Reader): string | undefined {
  const withSrc = existsSync(join(ROOT, dir, 'src'));
  const path = normalize(
    join(dir, built.replace(/^\.\/dist\//, withSrc ? './src/' : './'))
  ).replace(/\.js$/, '.ts');
  return reader(path) === undefined ? undefined : path;
}

function resolver(reader: Reader) {
  const packages = workspaceManifests();

  return (from: string, specifier: string): string | undefined => {
    if (specifier.startsWith('.')) {
      const base = normalize(join(dirname(from), specifier)).replace(/\.js$/, '');
      return [`${base}.ts`, `${base}/index.ts`].find(
        (candidate) => reader(candidate) !== undefined
      );
    }

    const name = /^(@vp\/[^/]+)/.exec(specifier)?.[1];
    const found = name ? packages.get(name) : undefined;
    if (!(name && found)) return undefined;

    const entry = found.manifest.exports?.[`.${specifier.slice(name.length)}`];
    const built = typeof entry === 'string' ? entry : (entry?.import ?? entry?.default);
    return built ? sourceOf(found.dir, built, reader) : undefined;
  };
}

/** Every module an entrypoint loads before its first dynamic import runs. */
function bootGraph(entry: string, reader: Reader): Set<string> {
  const resolve = resolver(reader);
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of (reader(file) ?? '').matchAll(STATIC_IMPORT)) {
      const next = resolve(file, specifier as string);
      if (next) queue.push(next);
    }
  }
  return seen;
}

const onDisk: Reader = (file) => (existsSync(join(ROOT, file)) ? read(file) : undefined);

describe('architecture: an external process never loads a test double', () => {
  it('recognises a boot path that reaches the in-memory doubles through a barrel', () => {
    const files: Record<string, string> = {
      'apps/api/src/main.ts': "import { buildApp } from './app';",
      'apps/api/src/app.ts': "export * from '../../../packages/server/adapters/index';",
      'packages/server/adapters/index.ts': "export * from './in-memory/index';",
      'packages/server/adapters/in-memory/index.ts': 'export class InMemoryCacheClient {}',
    };

    const graph = bootGraph('apps/api/src/main.ts', (file) => files[file]);

    expect([...graph].some((file) => file.startsWith(IN_MEMORY))).toBe(true);
  });

  it('keeps the in-memory doubles out of the @vp/adapters root barrel', () => {
    expect(read('packages/server/adapters/index.ts')).not.toMatch(/from '\.\/in-memory/);
  });

  it.each(['apps/api/src/main.ts', 'apps/worker/src/main.ts'])(
    'loads no in-memory double on the static boot path of %s',
    (entry) => {
      const graph = bootGraph(entry, onDisk);

      expect(graph.size).toBeGreaterThan(20);
      expect([...graph].filter((file) => file.startsWith(IN_MEMORY))).toEqual([]);
    }
  );
});
