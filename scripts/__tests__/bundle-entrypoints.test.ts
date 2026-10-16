import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../bundle-entrypoints.ts');

const FIXTURE: Readonly<Record<string, string>> = {
  'app/src/main.ts': [
    "import { greeting } from './greeting';",
    "import { shout } from '@vp/loud';",
    "import { pad } from 'npm-pad';",
    'console.log(pad(shout(greeting)));',
  ].join('\n'),
  'app/src/instrument.ts': [
    "import { shout } from '@vp/loud';",
    "export const banner = shout('instrumented');",
  ].join('\n'),
  'app/src/greeting.ts': "export const greeting = 'hello';",
  'app/node_modules/@vp/loud/package.json': JSON.stringify({
    name: '@vp/loud',
    type: 'module',
    exports: { '.': './dist/index.js' },
  }),
  'app/node_modules/@vp/loud/dist/index.js': "export { shout } from './shout';",
  'app/node_modules/@vp/loud/dist/shout.js': [
    "import { createRequire } from 'node:module';",
    'const require = createRequire(import.meta.url);',
    "const { EOL } = require('node:os');",
    'export const shout = (text) => `${text.toUpperCase()}, workspace`.replace(EOL, "");',
  ].join('\n'),
  'app/node_modules/npm-pad/package.json': JSON.stringify({ name: 'npm-pad', main: './index.js' }),
  'app/node_modules/npm-pad/index.js':
    "const { format } = require('node:util'); exports.pad = (text) => format('[%s] from npm', text);",
};

const ENTRIES = ['main.js', 'instrument.js'];
const LEFT_BY_A_PREVIOUS_BUILD = 'shared-0ld0ld.js';

function bundle(root: string, outdir: string): string {
  const out = join(root, outdir);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, LEFT_BY_A_PREVIOUS_BUILD), 'export const stale = true;');
  const run = runEntrypoint(
    ENTRYPOINT,
    [out, join(root, 'app/src/main.ts'), join(root, 'app/src/instrument.ts')],
    { PATH: process.env.PATH }
  );
  expect(run.stderr).toBe('');
  expect(run.status).toBe(0);
  return out;
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');

describe('scripts: bundle-entrypoints', () => {
  let root = '';
  let external = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'bundle-entrypoints-'));
    for (const [path, source] of Object.entries(FIXTURE)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    external = bundle(root, 'app/dist/external');
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('writes one file per entrypoint, one chunk for what both import, nothing older', () => {
    const files = readdirSync(external);
    const chunks = files.filter((file) => !ENTRIES.includes(file));

    expect(files).toEqual(expect.arrayContaining(ENTRIES));
    expect(chunks).toHaveLength(1);
    expect(read(external, chunks[0] as string)).toContain('workspace');
  });

  it('inlines relative modules and workspace packages, extensionless specifiers included', () => {
    const source = readdirSync(external)
      .map((file) => read(external, file))
      .join('\n');

    expect(source).toMatch(/["']hello["']/);
    expect(source).not.toMatch(/from ["']@vp\//);
    expect(source).not.toMatch(/from ["']\.\/(greeting|shout)["']/);
  });

  it('leaves an npm dependency for node_modules to provide', () => {
    expect(read(external, 'main.js')).toMatch(/from ["']npm-pad["']/);
  });

  it('links and loads every file in Node, a chunk declaring its own require included', () => {
    const imports = readdirSync(external)
      .filter((file) => file !== LEFT_BY_A_PREVIOUS_BUILD)
      .map((file) => `await import(${JSON.stringify(pathToFileURL(join(external, file)).href)});`);

    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', imports.join('\n')], {
      encoding: 'utf8',
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });
});
