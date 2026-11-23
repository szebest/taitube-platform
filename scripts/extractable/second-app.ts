import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { load } from 'js-yaml';
import type { Pkg } from '../workspace-packages';
import { platformClosure } from './closure';
import { appReferences } from './containment';
import { unlockedPackages, withoutTarballIntegrity } from './lockfile';
import { PRODUCT_NAME } from './product-name';
import {
  createSandbox,
  exec,
  failed,
  linksLeaving,
  loadedFiles,
  OFFLINE_INSTALL,
  type Report,
  runScript,
} from './sandbox';

export const SECOND_APP = 'second-app';
const SECOND_APP_DIR = 'tests/fixtures/second-app';
const TARBALLS = 'tarballs';
/** What a package runs or ships as data; its prose is the docs' business. */
const SHIPPED = /\.(?:[cm]?[jt]sx?|json|css|map)$/;

/** `@kit/<name>` packs to `tarballs/kit-<name>.tgz`, a name the app's manifest and overrides can hold across versions. */
export const tarballOf = (name: string): string =>
  `file:${TARBALLS}/${name.slice(1).replace('/', '-')}.tgz`;

/**
 * The app installs every package it reaches from a tarball, so its workspace file overrides exactly
 * the runtime closure of what it depends on: a missing override would send the install to a registry.
 */
export function overrideProblems(
  overrides: Readonly<Record<string, string>>,
  closure: readonly string[]
): string[] {
  const kit = Object.keys(overrides).filter((name) => name.startsWith('@kit/'));
  return [
    ...closure
      .filter((name) => overrides[name] !== tarballOf(name))
      .map((name) => `pnpm-workspace.yaml: override ${name} with ${tarballOf(name)}`),
    ...kit
      .filter((name) => !closure.includes(name))
      .map(
        (name) =>
          `pnpm-workspace.yaml: drop the override of ${name}, which the app no longer reaches`
      ),
  ].map((problem) => `${SECOND_APP_DIR}/${problem}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return walk(join(dir, entry.name));
    return entry.isFile() ? [join(dir, entry.name)] : [];
  });
}

function productLines(name: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      PRODUCT_NAME.test(line)
        ? [`${name}:${index + 1}: holds a value of this product: ${line.trim()}`]
        : []
    );
}

/**
 * What the installed `closure` packages hold that belongs to this product: its name, a dotted or
 * underscored prefix, an app package. A closure package the store does not hold is a problem too, so
 * an install that moved its packages elsewhere cannot pass by scanning nothing.
 * @public
 */
export function productValues(appRoot: string, closure: readonly string[]): string[] {
  const store = join(appRoot, 'node_modules/.pnpm');
  const installed = readdirSync(store)
    .filter((entry) => entry.startsWith('@kit+'))
    .flatMap((entry) => {
      const scope = join(store, entry, 'node_modules/@kit');
      return readdirSync(scope, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => ({ name: `@kit/${dirent.name}`, dir: join(scope, dirent.name) }));
    });
  const files = installed.flatMap(({ dir }) => walk(dir)).filter((file) => SHIPPED.test(file));
  const missing = closure
    .filter((name) => !installed.some((pkg) => pkg.name === name))
    .map((name) => `${name} is not installed in ${store}, so nothing of it was scanned`);
  if (files.length === 0) return [...missing, `no shipped file under ${store}/@kit+*`];
  return [
    ...missing,
    ...files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const name = relative(store, file);
      return [...productLines(name, text), ...appReferences(name, text)];
    }),
  ];
}

/**
 * Packs each `packSet` package from `sandbox`, a workspace of its build closure, with the `dist` this
 * repository built: building outside the repository is each package's own shard, and a pack from the
 * repository itself would follow its ignore files.
 */
async function packKit(
  repoRoot: string,
  sandbox: string,
  packSet: readonly Pkg[],
  destination: string
): Promise<string[]> {
  mkdirSync(destination, { recursive: true });
  const packed = await Promise.all(
    packSet.map((pkg) => {
      const dist = join(repoRoot, pkg.dir, 'dist');
      if (existsSync(dist)) cpSync(dist, join(sandbox, pkg.dir, 'dist'), { recursive: true });
      return exec('pnpm', ['pack', '--pack-destination', destination], join(sandbox, pkg.dir));
    })
  );
  const problems = packed.flatMap((outcome, index) =>
    outcome.code === 0 ? [] : [failed(`pnpm pack ${packSet[index]?.name}`, outcome.output)]
  );
  for (const file of readdirSync(destination)) {
    const name = file.replace(/-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/, '.tgz');
    renameSync(join(destination, file), join(destination, name));
  }
  return problems;
}

/**
 * A refresh starts from the repository's lockfile, so the app resolves every range to a version the
 * repository already locks: the store CI restores for that lockfile then holds all of them.
 */
async function runApp(
  repoRoot: string,
  appRoot: string,
  closure: readonly string[],
  refreshLockfile: boolean
): Promise<string[]> {
  if (refreshLockfile)
    copyFileSync(join(repoRoot, 'pnpm-lock.yaml'), join(appRoot, 'pnpm-lock.yaml'));
  const install = refreshLockfile
    ? ['install', '--offline', '--no-frozen-lockfile', '--trust-lockfile']
    : OFFLINE_INSTALL;
  const installed = await exec('pnpm', install, appRoot);
  if (installed.code !== 0) {
    const hint = refreshLockfile
      ? ''
      : `\nrun pnpm check:extractable ${SECOND_APP} --refresh-lockfile`;
    return [failed('pnpm install --offline', installed.output) + hint];
  }
  const ran = Promise.all([
    runScript('typecheck', appRoot),
    runScript('test', appRoot),
    loadedFiles(appRoot, appRoot),
  ]);
  const scanned = [...linksLeaving(appRoot), ...productValues(appRoot, closure)];
  return [...scanned, ...(await ran).flat()];
}

export async function checkSecondApp(
  repoRoot: string,
  packages: readonly Pkg[],
  { keep, refreshLockfile }: { keep: boolean; refreshLockfile: boolean }
): Promise<Report> {
  const started = performance.now();
  const report = (problems: string[]): Report => ({
    target: SECOND_APP,
    problems,
    seconds: Math.round((performance.now() - started) / 100) / 10,
  });
  const fixture = join(repoRoot, SECOND_APP_DIR);
  const manifest = JSON.parse(readFileSync(join(fixture, 'package.json'), 'utf8'));
  const workspace = load(readFileSync(join(fixture, 'pnpm-workspace.yaml'), 'utf8')) as {
    overrides?: Record<string, string>;
  };
  const direct = Object.keys(manifest.dependencies ?? {}).filter((name) =>
    name.startsWith('@kit/')
  );
  const packSet = platformClosure(direct, packages, 'runtime');
  const buildSet = platformClosure(direct, packages, 'all');
  if (!packSet.ok) return report([...packSet.problems]);
  if (!buildSet.ok) return report([...buildSet.problems]);
  const closure = packSet.packages.map((pkg) => pkg.name);
  const overrides = overrideProblems(workspace.overrides ?? {}, closure);
  if (overrides.length > 0) return report(overrides);
  const unlocked = refreshLockfile
    ? []
    : unlockedPackages(
        readFileSync(join(fixture, 'pnpm-lock.yaml'), 'utf8'),
        readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8')
      );
  if (unlocked.length > 0) {
    return report(
      unlocked.map(
        (key) =>
          `${SECOND_APP_DIR}/pnpm-lock.yaml locks ${key}, which the repository's lockfile does not`
      )
    );
  }

  const filters = packSet.packages.map((pkg) => `--filter=${pkg.name}`);
  const building = exec(
    'pnpm',
    ['exec', 'turbo', 'run', 'build', ...filters, '--output-logs=errors-only'],
    repoRoot
  );
  const { root, problems } = createSandbox(repoRoot, buildSet.packages, SECOND_APP);
  const appRoot = join(root, 'app');
  try {
    cpSync(fixture, appRoot, {
      recursive: true,
      filter: (source) => !/[/\\](node_modules|tarballs)$/.test(source),
    });
    const built = await building;
    if (built.code !== 0) problems.push(failed('building the packed packages', built.output));
    else {
      const packProblems = await packKit(repoRoot, root, packSet.packages, join(appRoot, TARBALLS));
      problems.push(
        ...(packProblems.length > 0
          ? packProblems
          : await runApp(repoRoot, appRoot, closure, refreshLockfile))
      );
    }
    if (refreshLockfile && existsSync(join(appRoot, 'pnpm-lock.yaml'))) {
      const lockfile = readFileSync(join(appRoot, 'pnpm-lock.yaml'), 'utf8');
      writeFileSync(join(fixture, 'pnpm-lock.yaml'), withoutTarballIntegrity(lockfile));
    }
    return report(problems);
  } finally {
    if (keep) process.stdout.write(`kept ${root}\n`);
    else rmSync(root, { recursive: true, force: true });
  }
}
