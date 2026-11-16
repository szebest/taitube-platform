import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { directoryTier, isPlatform, load, type Pkg } from './workspace-packages';

const MAP_FILE = 'docs/package-map.md';

const USAGE = `Usage: pnpm gen:package-map [--check] [root]

Writes ${MAP_FILE} from every workspace manifest: name, directory, scope, tier, layer and workspace
edges.

  --check   write nothing; exit 1 when ${MAP_FILE} differs from what would be written
  --help    print this text

Exit codes: 0 up to date or written, 1 stale (--check), 2 bad arguments.
`;

const HEADER = `# Package map

Every workspace package and app, generated from the manifests by \`pnpm gen:package-map\`: edit a
\`package.json\`, never this file, and \`pnpm gen:package-map --check\` fails CI when the two drift. The
scope (platform or app) and the tier are the directory and the layer is \`vp.layer\`
([packages/AGENTS.md](../packages/AGENTS.md)); where each package's exports are headed is
[scripts/package-moves.json](../scripts/package-moves.json).

| Package | Directory | Scope | Tier | Layer | Depends on | Dev-depends on |
|---|---|---|---|---|---|---|
`;

const names = (deps: readonly string[]) =>
  deps.length === 0 ? '-' : deps.map((name) => `\`${name}\``).join(', ');

export function renderPackageMap(packages: readonly Pkg[]): string {
  const rows = [...packages]
    .sort((a, b) => a.layer - b.layer || a.dir.localeCompare(b.dir))
    .map((pkg) => {
      const runtime = pkg.deps.filter((dep) => !dep.dev).map((dep) => dep.name);
      const dev = pkg.deps.filter((dep) => dep.dev).map((dep) => dep.name);
      const tier = directoryTier(pkg.dir) ?? '-';
      const scope = isPlatform(pkg.dir) ? 'platform' : 'app';
      return `| \`${pkg.name}\` | \`${pkg.dir}\` | ${scope} | ${tier} | T${pkg.layer} | ${names(runtime.sort())} | ${names(dev.sort())} |`;
    });
  return `${HEADER}${rows.join('\n')}\n`;
}

interface Outcome {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(argv: readonly string[], defaultRoot: string): Outcome {
  const flags = argv.filter((arg) => arg.startsWith('-'));
  const unknown = flags.find((flag) => !['--check', '--help', '-h'].includes(flag));
  if (unknown) {
    return { code: 2, stdout: '', stderr: `gen:package-map: unknown option ${unknown}\n${USAGE}` };
  }
  if (flags.includes('--help') || flags.includes('-h')) {
    return { code: 0, stdout: USAGE, stderr: '' };
  }

  const root = argv.find((arg) => !arg.startsWith('-')) ?? defaultRoot;
  const target = join(root, MAP_FILE);
  const rendered = renderPackageMap(load(root));

  if (!flags.includes('--check')) {
    writeFileSync(target, rendered);
    return { code: 0, stdout: `wrote ${MAP_FILE}\n`, stderr: '' };
  }
  if (existsSync(target) && readFileSync(target, 'utf8') === rendered) {
    return { code: 0, stdout: `gen:package-map: ${MAP_FILE} is up to date\n`, stderr: '' };
  }
  return {
    code: 1,
    stdout: '',
    stderr: `gen:package-map: ${MAP_FILE} is stale; run pnpm gen:package-map and commit it\n`,
  };
}

if (process.argv[1]?.endsWith('gen-package-map.ts')) {
  const outcome = run(process.argv.slice(2), resolve(import.meta.dirname, '..'));
  process.stdout.write(outcome.stdout);
  process.stderr.write(outcome.stderr);
  process.exitCode = outcome.code;
}
