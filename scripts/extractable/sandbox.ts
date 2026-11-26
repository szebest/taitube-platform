import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { dump, load } from 'js-yaml';
import type { Pkg } from '../workspace-packages';
import { appReferences, escapingPaths, isInside, outside } from './containment';
import { pruneLockfile } from './lockfile';

/** What the root workspace says about resolving dependencies; nothing that names a repository path. */
const RESOLUTION_SETTINGS = [
  'catalog',
  'catalogs',
  'overrides',
  'peerDependencyRules',
  'allowBuilds',
  'packageExtensions',
] as const;

export interface Report {
  target: string;
  problems: string[];
  seconds: number;
}

export interface Outcome {
  code: number;
  output: string;
}

/** The install every sandbox runs: offline, from the pruned lockfile as it is, which the repository's own install already verified. */
export const OFFLINE_INSTALL = ['install', '--offline', '--frozen-lockfile', '--trust-lockfile'];

export function exec(command: string, args: readonly string[], cwd: string): Promise<Outcome> {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', (error) => done({ code: 127, output: error.message }));
    child.on('close', (code) =>
      done({ code: code ?? 1, output: Buffer.concat(chunks).toString() })
    );
  });
}

function trackedFiles(repoRoot: string, dir: string): string[] {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', dir],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  if (listed.status !== 0) throw new Error(`git ls-files ${dir} failed: ${listed.stderr}`);
  return listed.stdout
    .split('\0')
    .filter(
      (path) =>
        path !== '' && lstatSync(join(repoRoot, path), { throwIfNoEntry: false }) !== undefined
    );
}

/** Where a symlink points, after `realpath` when its target exists. */
const linkTarget = (link: string): string =>
  existsSync(link) ? realpathSync(link) : resolve(realpathSync(dirname(link)), readlinkSync(link));

/** Copies one tracked file of `pkg`, a symlink as a symlink, and returns what it revealed. */
function copyTracked(repoRoot: string, root: string, pkg: Pkg, path: string): string[] {
  const source = join(repoRoot, path);
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  if (lstatSync(source).isSymbolicLink()) {
    const target = linkTarget(source);
    if (!isInside(realpathSync(join(repoRoot, pkg.dir)), target))
      return [`${path}: a symlink to ${target}, outside its package`];
    symlinkSync(readlinkSync(source), destination);
    return [];
  }
  const text = readFileSync(source, 'utf8');
  copyFileSync(source, destination);
  return [
    ...escapingPaths(join(root, pkg.dir), path.slice(pkg.dir.length + 1), text),
    ...appReferences(path, text),
  ];
}

function fillSandbox(repoRoot: string, root: string, packages: readonly Pkg[]): string[] {
  const problems = packages.flatMap((pkg) =>
    trackedFiles(repoRoot, pkg.dir).flatMap((path) => copyTracked(repoRoot, root, pkg, path))
  );
  const workspace = load(readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')) as Record<
    string,
    unknown
  >;
  const settings = Object.fromEntries(
    RESOLUTION_SETTINGS.filter((key) => key in workspace).map((key) => [key, workspace[key]])
  );
  writeFileSync(
    join(root, 'pnpm-workspace.yaml'),
    dump({ packages: packages.map((pkg) => pkg.dir), ...settings })
  );
  const { packageManager } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'extractable-sandbox', private: true, packageManager }, null, 2)
  );
  writeFileSync(
    join(root, 'pnpm-lock.yaml'),
    pruneLockfile(
      readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
      packages.map((pkg) => pkg.dir)
    )
  );
  return problems;
}

/**
 * A fresh workspace under the system temp directory holding `packages` at their repository paths,
 * the repository's lockfile (so an offline install needs no registry metadata) and the resolution
 * settings of its workspace file. Returns the directory and every problem the copy revealed; on a
 * throw it removes the directory first.
 */
export function createSandbox(
  repoRoot: string,
  packages: readonly Pkg[],
  label: string
): { root: string; problems: string[] } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `extractable-${label}-`)));
  let problems: string[] | undefined;
  try {
    if (isInside(repoRoot, root)) throw new Error(`${root} is inside the repository`);
    problems = fillSandbox(repoRoot, root, packages);
  } finally {
    if (problems === undefined) rmSync(root, { recursive: true, force: true });
  }
  return { root, problems };
}

/** Every symlink under `dir` whose target is not inside `root`: a dependency the sandbox did not install itself. */
export function linksLeaving(root: string, dir: string = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      return outside(root, [linkTarget(path)]).map((leaving) => `${path} links to ${leaving}`);
    }
    return entry.isDirectory() ? linksLeaving(root, path) : [];
  });
}

export const failed = (step: string, output: string): string =>
  `${step} failed:\n${output.trimEnd().split('\n').slice(-40).join('\n')}`;

/** Runs one script of the package in `dir`; its failure, with the output's tail, when it fails. */
export async function runScript(script: string, dir: string): Promise<string[]> {
  const ran = await exec('pnpm', ['run', script], dir);
  return ran.code === 0 ? [] : [failed(`pnpm run ${script}`, ran.output)];
}

/** Every file the compiler loads for the package's tsconfigs, after `realpath`, that is not inside `root`. */
export async function loadedFiles(root: string, dir: string): Promise<string[]> {
  const configs = ['tsconfig.json', 'tsconfig.spec.json'].filter((name) =>
    existsSync(join(dir, name))
  );
  const problems: string[] = [];
  for (const config of configs) {
    const listed = await exec('pnpm', ['exec', 'tsc', '--listFilesOnly', '-p', config], dir);
    const files = listed.output.split('\n').filter((line) => line.startsWith('/'));
    if (files.length === 0) {
      problems.push(failed(`tsc --listFilesOnly -p ${config}`, listed.output));
      continue;
    }
    problems.push(
      ...outside(
        root,
        files.map((file) => realpathSync(file))
      ).map((file) => `${config}: the compiler loads ${file}, outside the sandbox`)
    );
  }
  return problems;
}
