import { spawnSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Pkg } from '../../workspace-packages';
import { createSandbox, linksLeaving } from '../sandbox';

const PKG: Pkg = { name: '@kit/x', dir: 'packages/platform/universal/x', layer: 1, deps: [] };

const made: string[] = [];
const tempDir = (label: string): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `extractable-spec-${label}-`)));
  made.push(dir);
  return dir;
};

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function repoWith(files: Record<string, string>): string {
  const repo = tempDir('repo');
  spawnSync('git', ['init', '-q'], { cwd: repo });
  write(repo, 'package.json', '{ "packageManager": "pnpm@12.10.1" }');
  write(repo, 'pnpm-workspace.yaml', 'packages: []\n');
  write(repo, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  .: {}\n");
  write(repo, `${PKG.dir}/package.json`, '{ "name": "@kit/x" }');
  for (const [path, text] of Object.entries(files)) write(repo, path, text);
  return repo;
}

function sandboxProblems(repo: string): string[] {
  const { root, problems } = createSandbox(repo, [PKG], 'spec');
  made.push(root);
  return problems;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('scripts: extractable sandbox', () => {
  it('reports a file that names an app package', () => {
    const repo = repoWith({ [`${PKG.dir}/README.md`]: 'Works like @vp/domain.\n' });

    expect(sandboxProblems(repo)).toEqual([
      `${PKG.dir}/README.md:1: names an app package: Works like @vp/domain.`,
    ]);
  });

  it('fails a tracked symlink that leaves its package', () => {
    const repo = repoWith({ 'shared/types.ts': 'export type A = 1;\n' });
    symlinkSync('../../../../shared/types.ts', join(repo, PKG.dir, 'types.ts'));

    expect(sandboxProblems(repo)).toEqual([
      `${PKG.dir}/types.ts: a symlink to ${join(repo, 'shared/types.ts')}, outside its package`,
    ]);
  });

  it('copies a tracked symlink inside its package as a symlink', () => {
    const repo = repoWith({ [`${PKG.dir}/src/a.ts`]: 'export const a = 1;\n' });
    symlinkSync('src/a.ts', join(repo, PKG.dir, 'a.ts'));

    const { root, problems } = createSandbox(repo, [PKG], 'spec');
    made.push(root);

    expect(problems).toEqual([]);
    expect(lstatSync(join(root, PKG.dir, 'a.ts')).isSymbolicLink()).toBe(true);
  });

  it('removes its directory when filling it throws', () => {
    const repo = repoWith({});
    rmSync(join(repo, 'pnpm-workspace.yaml'));
    const label = `spec-throws-${process.pid}`;

    expect(() => createSandbox(repo, [PKG], label)).toThrow(/pnpm-workspace\.yaml/);
    expect(
      readdirSync(tmpdir()).filter((entry) => entry.startsWith(`extractable-${label}-`))
    ).toEqual([]);
  });

  it('names a link whose target is outside the root', () => {
    const root = tempDir('root');
    const elsewhere = tempDir('elsewhere');
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(elsewhere, join(root, 'node_modules/leak'));

    expect(linksLeaving(root)).toEqual([
      `${join(root, 'node_modules/leak')} links to ${elsewhere}`,
    ]);
  });
});
