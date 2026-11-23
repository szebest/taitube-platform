import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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
} from './sandbox';

export const SECOND_APP = 'second-app';
const SECOND_APP_DIR = 'tests/fixtures/second-app';
const TARBALLS = 'tarballs';
/** What a package runs or ships as data; its prose is the docs' business. */
const SHIPPED = /\.(?:[cm]?[jt]sx?|json|css)$/;

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

/** What the installed tarballs hold that belongs to this product: its name, a dotted or underscored prefix, an app package. */
function productValues(appRoot: string): string[] {
  const store = join(appRoot, 'node_modules/.pnpm');
  return readdirSync(store)
    .filter((entry) => entry.startsWith('@kit+'))
    .flatMap((entry) => walk(join(store, entry, 'node_modules/@kit')))
    .filter((file) => SHIPPED.test(file))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const name = relative(store, file);
      const named = text
        .split('\n')
        .flatMap((line, index) =>
          PRODUCT_NAME.test(line)
            ? [`${name}:${index + 1}: holds a value of this product: ${line.trim()}`]
            : []
        );
      return [...named, ...appReferences(name, text)];
    });
}

async function packKit(
  sandbox: string,
  packSet: readonly Pkg[],
  appRoot: string
): Promise<string[]> {
  const packed = await Promise.all(
    packSet.map((pkg) =>
      exec('pnpm', ['pack', '--pack-destination', join(appRoot, TARBALLS)], join(sandbox, pkg.dir))
    )
  );
  const problems = packed.flatMap((outcome, index) =>
    outcome.code === 0 ? [] : [failed(`pnpm pack ${packSet[index]?.name}`, outcome.output)]
  );
  for (const file of readdirSync(join(appRoot, TARBALLS))) {
    const name = file.replace(/-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/, '.tgz');
    renameSync(join(appRoot, TARBALLS, file), join(appRoot, TARBALLS, name));
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
  const problems = [...linksLeaving(appRoot), ...productValues(appRoot)];
  for (const script of ['typecheck', 'test']) {
    const ran = await exec('pnpm', ['run', script], appRoot);
    if (ran.code !== 0) problems.push(failed(`pnpm run ${script}`, ran.output));
  }
  return [...problems, ...(await loadedFiles(appRoot, appRoot))];
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
  const overrides = overrideProblems(
    workspace.overrides ?? {},
    packSet.packages.map((pkg) => pkg.name)
  );
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

  const { root: sandbox, problems } = createSandbox(repoRoot, buildSet.packages, SECOND_APP);
  const appRoot = realpathSync(mkdtempSync(join(tmpdir(), `extractable-${SECOND_APP}-app-`)));
  cpSync(fixture, appRoot, {
    recursive: true,
    filter: (source) => !/[/\\](node_modules|tarballs)$/.test(source),
  });

  const steps = async (): Promise<string[]> => {
    const installed = await exec('pnpm', OFFLINE_INSTALL, sandbox);
    if (installed.code !== 0) return [failed('pnpm install --offline', installed.output)];
    const filters = packSet.packages.flatMap((pkg) => ['--filter', pkg.name]);
    const built = await exec(
      'pnpm',
      ['--recursive', ...filters, 'run', '--if-present', 'build'],
      sandbox
    );
    if (built.code !== 0) return [failed('building the packed packages', built.output)];
    const packProblems = await packKit(sandbox, packSet.packages, appRoot);
    return packProblems.length > 0 ? packProblems : runApp(repoRoot, appRoot, refreshLockfile);
  };
  problems.push(...(await steps()));

  if (refreshLockfile && existsSync(join(appRoot, 'pnpm-lock.yaml'))) {
    const lockfile = readFileSync(join(appRoot, 'pnpm-lock.yaml'), 'utf8');
    writeFileSync(join(fixture, 'pnpm-lock.yaml'), withoutTarballIntegrity(lockfile));
  }
  if (keep) process.stdout.write(`kept ${sandbox} and ${appRoot}\n`);
  else for (const dir of [sandbox, appRoot]) rmSync(dir, { recursive: true, force: true });
  return report(problems);
}
