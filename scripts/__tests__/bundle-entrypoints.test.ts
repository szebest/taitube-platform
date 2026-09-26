import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  'app/node_modules/@vp/loud/dist/shout.js':
    'export const shout = (text) => `${text.toUpperCase()}, workspace`;',
  'app/node_modules/npm-pad/package.json': JSON.stringify({ name: 'npm-pad', main: './index.js' }),
  'app/node_modules/npm-pad/index.js':
    "const { format } = require('node:util'); exports.pad = (text) => format('[%s] from npm', text);",
};

const ENTRIES = ['main.js', 'instrument.js'];

function bundle(root: string, outdir: string, flags: string[]): string {
  const out = join(root, outdir);
  const run = runEntrypoint(
    ENTRYPOINT,
    [...flags, out, join(root, 'app/src/main.ts'), join(root, 'app/src/instrument.ts')],
    { PATH: process.env.PATH }
  );
  expect(run.stderr).toBe('');
  expect(run.status).toBe(0);
  return out;
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
const everything = (dir: string) =>
  readdirSync(dir)
    .map((file) => read(dir, file))
    .join('\n');

describe('scripts: bundle-entrypoints', () => {
  let root = '';
  let external = '';
  let inlined = '';

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'bundle-entrypoints-'));
    for (const [path, source] of Object.entries(FIXTURE)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    external = bundle(root, 'app/dist/external', []);
    inlined = bundle(root, 'standalone', ['--inline-npm']);
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it.each([
    { mode: 'npm external', dir: () => external },
    { mode: '--inline-npm', dir: () => inlined },
  ])('$mode: one file per entrypoint and one chunk for what both import', ({ dir }) => {
    const files = readdirSync(dir());
    const chunks = files.filter((file) => !ENTRIES.includes(file));

    expect(files).toEqual(expect.arrayContaining(ENTRIES));
    expect(chunks).toHaveLength(1);
    expect(read(dir(), chunks[0] as string)).toContain('workspace');
  });

  it('inlines relative modules and workspace packages, extensionless specifiers included', () => {
    const source = everything(external);

    expect(source).toMatch(/["']hello["']/);
    expect(source).not.toMatch(/from ["']@vp\//);
    expect(source).not.toMatch(/from ["']\.\/(greeting|shout)["']/);
  });

  it('leaves an npm dependency for node_modules to provide', () => {
    expect(read(external, 'main.js')).toMatch(/from ["']npm-pad["']/);
  });

  it('--inline-npm runs with no node_modules, a CommonJS require of a builtin included', () => {
    const run = spawnSync(process.execPath, [join(inlined, 'main.js')], { encoding: 'utf8' });

    expect(everything(inlined)).not.toMatch(/from ["']npm-pad["']/);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim()).toBe('[HELLO, workspace] from npm');
  });
});
