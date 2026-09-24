import { execFileSync } from 'node:child_process';
import { matchesGlob, posix } from 'node:path';
import { markdownDocument, trackedDocuments } from './markdown';
import { ROOT, read, trackedFiles, trackedPaths } from './repo-files';
import { type Command, commandsIn, makeTargets, phonyTargets } from './shell-commands';

/** The documents a reader follows as instructions; the rest of `docs/` is a record of past work. */
function checkedDocuments(): string[] {
  return trackedDocuments().filter(
    (file) =>
      ['README.md', 'ARCHITECTURE.md', 'CONTEXT.md', 'docs/SDD.md'].includes(file) ||
      file.startsWith('docs/standards/') ||
      file.startsWith('docs/runbooks/') ||
      file.endsWith('AGENTS.md')
  );
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

function existsInRepo(path: string, paths: ReadonlySet<string>): boolean {
  const glob = asGlob(path);
  const wildcardAt = glob.search(/[*{]/);
  if (wildcardAt === -1) return paths.has(path);
  const literalPrefix = glob.slice(0, wildcardAt);
  return [...paths].some(
    (candidate) => candidate.startsWith(literalPrefix) && matchesGlob(candidate, glob)
  );
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
