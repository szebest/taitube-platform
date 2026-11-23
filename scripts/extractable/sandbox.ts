import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
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

/** Only what a fresh shell would carry: no module path, no package or script variables of the repository's run. */
function cleanEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        key !== 'NODE_PATH' &&
        key !== 'INIT_CWD' &&
        !key.startsWith('npm_') &&
        !key.startsWith('PNPM_SCRIPT') &&
        !key.startsWith('PNPM_PACKAGE')
    )
  );
}

/** The install every sandbox runs: offline, from the pruned lockfile as it is, which the repository's own install already verified. */
export const OFFLINE_INSTALL = ['install', '--offline', '--frozen-lockfile', '--trust-lockfile'];

export function exec(command: string, args: readonly string[], cwd: string): Promise<Outcome> {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
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
    .filter((path) => path !== '' && existsSync(join(repoRoot, path)));
}

/**
 * A fresh workspace under the system temp directory holding `packages` at their repository paths,
 * the repository's lockfile (so an offline install needs no registry metadata) and the resolution
 * settings of its workspace file. Returns the directory and every problem the copy revealed.
 */
export function createSandbox(
  repoRoot: string,
  packages: readonly Pkg[],
  label: string
): { root: string; problems: string[] } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), `extractable-${label}-`)));
  if (isInside(repoRoot, root)) throw new Error(`${root} is inside the repository`);
  const problems: string[] = [];

  for (const pkg of packages) {
    for (const path of trackedFiles(repoRoot, pkg.dir)) {
      const text = readFileSync(join(repoRoot, path), 'utf8');
      const inPackage = path.slice(pkg.dir.length + 1);
      problems.push(...escapingPaths(join(root, pkg.dir), inPackage, text));
      problems.push(...appReferences(path, text));
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(join(repoRoot, path), join(root, path));
    }
  }

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
    JSON.stringify({ name: `extractable-${label}`, private: true, packageManager }, null, 2)
  );
  writeFileSync(
    join(root, 'pnpm-lock.yaml'),
    pruneLockfile(
      readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8'),
      packages.map((pkg) => pkg.dir)
    )
  );
  return { root, problems };
}

/** Every symlink under `dir` whose target is not inside `root`: a dependency the sandbox did not install itself. */
export function linksLeaving(root: string, dir: string = root): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = existsSync(path) ? realpathSync(path) : resolve(dir, readlinkSync(path));
      return outside(root, [target]).map((leaving) => `${path} links to ${leaving}`);
    }
    return entry.isDirectory() ? linksLeaving(root, path) : [];
  });
}

export const failed = (step: string, output: string): string =>
  `${step} failed:\n${output.trimEnd().split('\n').slice(-40).join('\n')}`;

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
