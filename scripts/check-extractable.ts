import { appendFileSync, readFileSync, rmSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { platformClosure } from './extractable/closure';
import {
  createSandbox,
  exec,
  failed,
  linksLeaving,
  loadedFiles,
  OFFLINE_INSTALL,
  type Report,
  runScript,
} from './extractable/sandbox';
import { checkSecondApp, SECOND_APP } from './extractable/second-app';
import { isPlatform, load, type Pkg } from './workspace-packages';

const USAGE = `Usage: pnpm check:extractable [<package>...] [${SECOND_APP}] [--list] [--github-output]
                              [--refresh-lockfile] [--keep]

Proves each platform package works outside this repository. For the packages named (default: every
package under packages/platform, and the second app beside them) it copies their platform closure,
from the manifests' dependencies, peers and dev edges, to a fresh temp directory with a workspace file
that lists only that closure, then:

  1. installs offline and frozen from the local pnpm store, with this repository's lockfile cut
     down to the closure, so no registry and no metadata cache is needed;
  2. builds the closure, then runs the package's own typecheck and test scripts there;
  3. fails when a copied file names an app package (@vp/...), when a path in a source file, tsconfig
     or manifest leaves its package folder, when a tracked symlink, an installed link or a file the
     compiler loads resolves outside it.

${SECOND_APP} builds the packages tests/fixtures/second-app reaches at runtime with turbo, packs them with
pnpm pack from a copy of their closure, installs the app from those tarballs and runs its typecheck and
spec (scripts/extractable/second-app.ts).

  <package>         @kit/<name> or <name>; several run in one sandbox, built once
  --list            print the targets as a JSON array and exit
  --github-output   with --list, also write extractable=<array> to $GITHUB_OUTPUT
  --refresh-lockfile  with ${SECOND_APP}: resolve from the repository lockfile and write the app's pnpm-lock.yaml back
  --keep            leave the temp directories in place and print where they are
  --help            print this text

Exit codes: 0 every target extractable, 1 a target failed, 2 bad arguments.
`;

const REPO = resolve(import.meta.dirname, '..');
const FLAGS = ['--list', '--github-output', '--keep', '--refresh-lockfile', '--help', '-h'];
const CONCURRENCY = Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2)));

const seconds = (since: number): number => Math.round((performance.now() - since) / 100) / 10;

async function pool<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>) {
  const results: R[] = [];
  let next = 0;
  const lane = async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await work(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
  return results;
}

async function checkTarget(root: string, pkg: Pkg): Promise<Report> {
  const started = performance.now();
  const dir = join(root, pkg.dir);
  const scripts: Record<string, string> =
    JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {};
  const ran = await Promise.all([
    ...['typecheck', 'test'].filter((name) => name in scripts).map((name) => runScript(name, dir)),
    loadedFiles(root, dir),
  ]);
  return { target: pkg.name, problems: ran.flat(), seconds: seconds(started) };
}

async function setUp(root: string, targets: readonly Pkg[]): Promise<string[]> {
  const installed = await exec('pnpm', OFFLINE_INSTALL, root);
  if (installed.code !== 0) return [failed('pnpm install --offline', installed.output)];
  const leaving = linksLeaving(root);
  if (leaving.length > 0) return leaving;
  const filters = targets.flatMap((pkg) => ['--filter', `${pkg.name}^...`]);
  const built = await exec(
    'pnpm',
    [
      '--recursive',
      `--workspace-concurrency=${availableParallelism()}`,
      ...filters,
      'run',
      '--if-present',
      'build',
    ],
    root
  );
  return built.code === 0 ? [] : [failed('building the closure', built.output)];
}

async function checkPackages(targets: readonly Pkg[], packages: readonly Pkg[], keep: boolean) {
  const closure = platformClosure(
    targets.map((pkg) => pkg.name),
    packages,
    'all'
  );
  if (!closure.ok)
    return targets.map((pkg) => ({
      target: pkg.name,
      problems: [...closure.problems],
      seconds: 0,
    }));

  const started = performance.now();
  const { root, problems } = createSandbox(REPO, closure.packages, 'packages');
  try {
    const shared = [...problems, ...(await setUp(root, targets))];
    process.stdout.write(
      `sandbox ${root}: ${closure.packages.length} packages ready in ${seconds(started)} s\n`
    );
    return shared.length > 0
      ? targets.map((pkg) => ({ target: pkg.name, problems: shared, seconds: 0 }))
      : await pool(targets, CONCURRENCY, (pkg) => checkTarget(root, pkg));
  } finally {
    if (keep) process.stdout.write(`kept ${root}\n`);
    else rmSync(root, { recursive: true, force: true });
  }
}

function resolveTargets(names: readonly string[], platform: readonly Pkg[]) {
  const unknown: string[] = [];
  const found = names.flatMap((name) => {
    const pkg = platform.find(
      (candidate) => candidate.name === name || candidate.name === `@kit/${name}`
    );
    if (pkg === undefined) unknown.push(name);
    return pkg === undefined ? [] : [pkg];
  });
  return { found, unknown };
}

/** The sandboxes run what a fresh shell would: no module path, no package or script variables of this run. */
function forgetRepositoryRun(env: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(env)) {
    if (/^(NODE_PATH|INIT_CWD)$|^npm_|^PNPM_(SCRIPT|PACKAGE)/.test(key)) delete env[key];
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const flags = argv.filter((arg) => arg.startsWith('-'));
  const unknownFlag = flags.find((flag) => !FLAGS.includes(flag));
  if (unknownFlag !== undefined) {
    process.stderr.write(`check:extractable: unknown option ${unknownFlag}\n${USAGE}`);
    return 2;
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    process.stdout.write(USAGE);
    return 0;
  }

  const packages = load(REPO);
  const platform = packages.filter((pkg) => isPlatform(pkg.dir));
  if (flags.includes('--list')) {
    const list = JSON.stringify([...platform.map((pkg) => pkg.name), SECOND_APP]);
    process.stdout.write(`${list}\n`);
    if (flags.includes('--github-output') && process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `extractable=${list}\n`);
    }
    return 0;
  }

  const names = argv.filter((arg) => !arg.startsWith('-'));
  const runSecondApp = names.length === 0 || names.includes(SECOND_APP);
  const { found, unknown } = resolveTargets(
    names.filter((name) => name !== SECOND_APP),
    platform
  );
  if (unknown.length > 0) {
    process.stderr.write(`check:extractable: no platform package ${unknown.join(', ')}\n${USAGE}`);
    return 2;
  }
  const targets = names.length === 0 ? platform : found;
  const keep = flags.includes('--keep');

  const [packageReports, secondApp] = await Promise.all([
    targets.length === 0 ? [] : checkPackages(targets, packages, keep),
    runSecondApp
      ? checkSecondApp(REPO, packages, {
          keep,
          refreshLockfile: flags.includes('--refresh-lockfile'),
        })
      : undefined,
  ]);
  const reports = secondApp === undefined ? packageReports : [...packageReports, secondApp];

  for (const { target, problems, seconds: took } of reports) {
    process.stdout.write(`${problems.length === 0 ? 'ok  ' : 'FAIL'} ${target} (${took} s)\n`);
    for (const problem of problems)
      process.stdout.write(`     ${problem.replaceAll('\n', '\n     ')}\n`);
  }
  return reports.every((report) => report.problems.length === 0) ? 0 : 1;
}

if (process.argv[1]?.endsWith('check-extractable.ts')) {
  forgetRepositoryRun(process.env);
  process.exitCode = await main(process.argv.slice(2));
}
