import { execFileSync } from 'node:child_process';
import { matchesGlob, posix } from 'node:path';
import { markdownDocument, trackedDocuments } from './markdown';
import { ROOT, read, trackedFiles } from './repo-files';

/** Where a reader is told to run something. Tickets and reviews are history, not instructions. */
function checkedDocuments(): string[] {
  return trackedDocuments().filter(
    (file) =>
      ['README.md', 'ARCHITECTURE.md', 'CONTEXT.md', 'docs/SDD.md'].includes(file) ||
      file.startsWith('docs/standards/') ||
      file.startsWith('docs/runbooks/') ||
      file.endsWith('AGENTS.md')
  );
}

type Command =
  | { type: 'pnpm'; script: string; filter: string | undefined }
  | { type: 'make'; target: string };

/** pnpm's own commands: running one of these names no script. */
const PNPM_BUILTINS = new Set([
  'add',
  'audit',
  'config',
  'create',
  'deploy',
  'dlx',
  'exec',
  'i',
  'install',
  'list',
  'ls',
  'outdated',
  'prune',
  'remove',
  'store',
  'update',
  'why',
]);

const COMMAND_SEPARATORS = /&&|\|\||[;|()`]|\$\(/;

function isPlaceholder(word: string): boolean {
  return word.includes('<') || word.includes('…') || word.includes('$');
}

function pnpmCommand(words: readonly string[]): Command | undefined {
  let filter: string | undefined;
  let index = 0;
  while ((words[index] ?? '').startsWith('-')) {
    const flag = words[index];
    index += 1;
    if (flag === '--filter' || flag === '-F') {
      filter = words[index];
      index += 1;
    }
  }
  let script = words[index];
  if (script === 'run') script = words[index + 1];
  if (script === undefined || isPlaceholder(script) || PNPM_BUILTINS.has(script)) return undefined;
  return { type: 'pnpm', script, filter };
}

function makeCommand(words: readonly string[]): Command | undefined {
  const target = words.find((word) => !word.startsWith('-') && !word.includes('='));
  if (target === undefined || isPlaceholder(target)) return undefined;
  return { type: 'make', target };
}

function withoutComment(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('#')) return '';
  const commentAt = trimmed.indexOf(' #');
  return commentAt === -1 ? trimmed : trimmed.slice(0, commentAt);
}

/** The command a shell part runs, once any `NAME=value` prefix is read past. */
function commandOf(part: string): Command | undefined {
  const words = part.trim().split(/\s+/);
  const start = words.findIndex((word) => !word.includes('='));
  const [program, ...rest] = words.slice(start);
  if (program === 'pnpm') return pnpmCommand(rest);
  if (program === 'make') return makeCommand(rest);
  return undefined;
}

/** Every `pnpm <script>` and `make <target>` run in a code span or block. */
function commandsIn(text: string): Command[] {
  return text
    .split('\n')
    .map(withoutComment)
    .flatMap((line) => line.split(COMMAND_SEPARATORS))
    .map(commandOf)
    .filter((command) => command !== undefined);
}

interface Workspace {
  name: string;
  dir: string;
  scripts: ReadonlySet<string>;
}

interface Manifest {
  name: string;
  scripts?: Record<string, string>;
}

function manifestOf(file: string): Manifest {
  const manifest: Manifest = JSON.parse(read(file));
  return manifest;
}

function scriptsOf(file: string): ReadonlySet<string> {
  return new Set(Object.keys(manifestOf(file).scripts ?? {}));
}

function workspaces(): Workspace[] {
  return trackedFiles(':(glob)apps/*/package.json', ':(glob)packages/*/*/package.json').map(
    (manifest) => ({
      name: manifestOf(manifest).name,
      dir: posix.dirname(manifest),
      scripts: scriptsOf(manifest),
    })
  );
}

/** Every rule the Makefile defines, read the way `make help` reads them: `name:` at column 0. */
function makeTargets(makefile: string): string[] {
  return makefile
    .split('\n')
    .map((line) => /^([A-Za-z0-9_-]+):(?!=)/.exec(line)?.[1])
    .filter((target) => target !== undefined);
}

function phonyTargets(makefile: string): string[] {
  const phony = makefile.split('\n').find((line) => line.startsWith('.PHONY:'));
  return (phony ?? '').replace('.PHONY:', '').trim().split(/\s+/).filter(Boolean);
}

interface Scope {
  rootScripts: ReadonlySet<string>;
  workspaces: readonly Workspace[];
  targets: ReadonlySet<string>;
}

function missingCommand(command: Command, scope: Scope): string | undefined {
  switch (command.type) {
    case 'make':
      return scope.targets.has(command.target) ? undefined : `make ${command.target}`;
    case 'pnpm': {
      if (command.filter === undefined) {
        return scope.rootScripts.has(command.script) ? undefined : `pnpm ${command.script}`;
      }
      const selector = command.filter.replace(/^\.\//, '');
      const workspace = scope.workspaces.find(
        (candidate) => candidate.name === selector || candidate.dir === selector
      );
      if (workspace?.scripts.has(command.script)) return undefined;
      return `pnpm --filter ${command.filter} ${command.script}`;
    }
    default:
      return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled command ${JSON.stringify(value)}`);
}

function repoScope(): Scope {
  return {
    rootScripts: scriptsOf('package.json'),
    workspaces: workspaces(),
    targets: new Set(makeTargets(read('Makefile'))),
  };
}

const TOP_LEVEL = new Set(trackedFiles().map((file) => file.split('/')[0] ?? ''));

/** `packages/<tier>/` and `{a,b}` name a set of paths; as a glob, each must match one. */
function asGlob(path: string): string {
  return path.replaceAll(/<[^>]+>/g, '*');
}

function pathOf(span: string): string | undefined {
  if (/\s/.test(span) || !span.includes('/')) return undefined;
  const path = span.replace(/[:#].*$/, '').replace(/\/$/, '');
  return TOP_LEVEL.has(path.split('/')[0] ?? '') ? path : undefined;
}

function trackedPaths(): Set<string> {
  const paths = new Set<string>();
  for (const file of trackedFiles()) {
    paths.add(file);
    let directory = posix.dirname(file);
    while (directory !== '.' && !paths.has(directory)) {
      paths.add(directory);
      directory = posix.dirname(directory);
    }
  }
  return paths;
}

function existsInRepo(path: string, paths: ReadonlySet<string>): boolean {
  const glob = asGlob(path);
  if (glob === path && !path.includes('*') && !path.includes('{')) return paths.has(path);
  return [...paths].some((candidate) => matchesGlob(candidate, glob));
}

/** Paths git ignores are what a build or an install writes; a document may name them. */
function ignoredByGit(paths: readonly string[]): Set<string> {
  if (paths.length === 0) return new Set();
  try {
    const output = execFileSync('git', ['check-ignore', '--no-index', '--stdin'], {
      cwd: ROOT,
      encoding: 'utf8',
      input: paths.join('\n'),
    });
    return new Set(output.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

function missingPaths(documents: readonly string[]): string[] {
  const paths = trackedPaths();
  const missing: { document: string; path: string }[] = [];
  for (const document of documents) {
    for (const span of markdownDocument(document).codeSpans) {
      const path = pathOf(span);
      if (path !== undefined && !existsInRepo(path, paths)) missing.push({ document, path });
    }
  }
  const ignored = ignoredByGit(missing.map(({ path }) => path));
  return missing
    .filter(({ path }) => !ignored.has(path))
    .map(({ document, path }) => `${document}: ${path}`);
}

const TREE_GLYPHS = /^[\s│├└─]+/;

/** The `packages/<tier>/<name>` directories the README's monorepo tree draws. */
function packagesInTree(readme: string): string[] {
  const tree = markdownDocument(readme).codeBlocks.find((block) => block.includes('├── packages/'));
  const drawn: string[] = [];
  let inPackages = false;
  let tier = '';
  for (const line of (tree ?? '').split('\n')) {
    const entry = line.replace(TREE_GLYPHS, '').split(/\s+/)[0] ?? '';
    const depth = line.length - line.replace(TREE_GLYPHS, '').length;
    if (entry === 'packages/') inPackages = true;
    else if (inPackages && depth <= 4) inPackages = false;
    else if (inPackages && depth === 8) tier = entry.replace(/\/$/, '');
    else if (inPackages && depth === 12) drawn.push(`packages/${tier}/${entry.replace(/\/$/, '')}`);
  }
  return drawn;
}

describe('architecture: doc-commands', () => {
  const makefile = [
    '.PHONY: up e2e',
    'up: ## Start',
    'e2e:',
    'DEV_TOKEN := pnpm dev-token',
    'load-smoke: up',
  ].join('\n');

  const fixtureScope: Scope = {
    rootScripts: new Set(['dev-token', 'test']),
    workspaces: [{ name: '@vp/web', dir: 'apps/web', scripts: new Set(['build']) }],
    targets: new Set(makeTargets(makefile)),
  };

  it('reads pnpm scripts, filtered scripts and make targets out of shell, and fires on the missing ones', () => {
    const shell = [
      'TOKEN=$(pnpm --silent dev-token mint --raw) && pnpm test',
      'pnpm --filter @vp/web build; pnpm --filter @vp/web start',
      'pnpm install && pnpm exec tsx x.ts && pnpm dlx y',
      'E2E_REDUCED=true make e2e',
      'make up-all # make sure it is up',
      'pnpm run gen-video --only s2',
      'pnpm <script>',
    ].join('\n');

    const missing = commandsIn(shell)
      .map((command) => missingCommand(command, fixtureScope))
      .filter((found) => found !== undefined);

    expect(missing).toEqual(['pnpm --filter @vp/web start', 'make up-all', 'pnpm gen-video']);
  });

  it('reads Makefile rules without the variables and prerequisites beside them', () => {
    expect(makeTargets(makefile)).toEqual(['up', 'e2e', 'load-smoke']);
    expect(phonyTargets(makefile)).toEqual(['up', 'e2e']);
  });

  it('names every pnpm script and make target that exists', () => {
    const scope = repoScope();
    const missing = checkedDocuments().flatMap((document) => {
      const { codeSpans, codeBlocks } = markdownDocument(document);
      return [...codeSpans, ...codeBlocks]
        .flatMap(commandsIn)
        .map((command) => missingCommand(command, scope))
        .filter((found) => found !== undefined)
        .map((found) => `${document}: ${found}`);
    });

    expect(missing).toEqual([]);
  });

  it('declares exactly the Makefile rules as .PHONY', () => {
    const makefileText = read('Makefile');

    expect([...phonyTargets(makefileText)].sort()).toEqual([...makeTargets(makefileText)].sort());
  });

  it('fires on a backticked path that does not exist, and reads placeholders as globs', () => {
    const paths = new Set(['packages/server/adapters', 'docs/tickets/88-health.md']);

    expect(existsInRepo('packages/<tier>/adapters', paths)).toBe(true);
    expect(existsInRepo('docs/tickets/<NN>-slug.md', paths)).toBe(false);
    expect(existsInRepo('docs/tickets/<NN>-<slug>.md', paths)).toBe(true);
    expect(existsInRepo('packages/{server,client}/adapters', paths)).toBe(true);
    expect(existsInRepo('packages/server/logger', paths)).toBe(false);
  });

  it('names only repo paths that exist or that a build writes', () => {
    expect(missingPaths(checkedDocuments())).toEqual([]);
  });

  it('draws every workspace package in the README tree, and only those', () => {
    const packages = trackedFiles(':(glob)packages/*/*/package.json').map(posix.dirname);

    expect(packagesInTree('README.md').sort()).toEqual(packages.sort());
  });
});

