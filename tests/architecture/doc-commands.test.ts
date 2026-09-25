import { posix } from 'node:path';
import { existsInRepo, missingPaths } from './doc-paths';
import { markdownDocument, trackedDocuments } from './markdown';
import { read, trackedFiles, trackedPaths } from './repo-files';
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

function phonyFindings(makefile: string): string[] {
  const phony = new Set(phonyTargets(makefile));
  const rules = makeTargets(makefile);
  return [
    ...rules.filter((rule) => !phony.has(rule)).map((rule) => `${rule} is not .PHONY`),
    ...[...phony]
      .filter((name) => !rules.includes(name))
      .map((name) => `${name} is .PHONY but no rule`),
  ];
}

const TREE_GLYPHS = /^[\s│├└─]+/;
const TREE_INDENT = 4;
const TOP_LEVEL_DIRECTORY = 1;
const TIER = 2;
const PACKAGE = 3;

interface TreeEntry {
  level: number;
  name: string;
}

/** A tree line's depth (one per four columns of glyphs) and its first word, with the trailing `/` gone. */
function treeEntry(line: string): TreeEntry {
  const glyphs = TREE_GLYPHS.exec(line)?.[0] ?? '';
  const name = (line.slice(glyphs.length).split(/\s+/)[0] ?? '').replace(/\/$/, '');
  return { level: glyphs.length / TREE_INDENT, name };
}

/** The `packages/<tier>/<name>` directories a monorepo tree draws. */
function packagesInTree(tree: string): string[] {
  const drawn: string[] = [];
  let inPackages = false;
  let tier = '';
  for (const { level, name } of tree.split('\n').map(treeEntry)) {
    if (level === TOP_LEVEL_DIRECTORY) inPackages = name === 'packages';
    else if (inPackages && level === TIER) tier = name;
    else if (inPackages && level === PACKAGE) drawn.push(`packages/${tier}/${name}`);
  }
  return drawn;
}

function readmeTree(): string {
  return (
    markdownDocument('README.md').codeBlocks.find((block) => block.includes('├── packages/')) ?? ''
  );
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

  it('fires on a rule missing from .PHONY and on a .PHONY name with no rule', () => {
    expect(phonyFindings(makefile)).toEqual(['load-smoke is not .PHONY']);
    expect(phonyFindings(`${makefile}\n.PHONY: gone`)).toEqual(['load-smoke is not .PHONY']);
    expect(phonyFindings('.PHONY: up gone\nup:')).toEqual(['gone is .PHONY but no rule']);
  });

  it('declares exactly the Makefile rules as .PHONY', () => {
    expect(phonyFindings(read('Makefile'))).toEqual([]);
  });

  it('fires on a backticked path that does not exist, and reads placeholders as globs', () => {
    const paths = new Set(['packages/server/adapters', 'docs/tickets/88-health.md']);

    expect(existsInRepo('packages/<tier>/adapters', paths)).toBe(true);
    expect(existsInRepo('docs/tickets/<NN>-slug.md', paths)).toBe(false);
    expect(existsInRepo('docs/tickets/<NN>-<slug>.md', paths)).toBe(true);
    expect(existsInRepo('packages/{server,client}/adapters', paths)).toBe(true);
    expect(existsInRepo('packages/server/logger', paths)).toBe(false);
  });

  it('fires on a path nothing tracks, and passes one a build or an install writes', () => {
    const spans = [
      {
        document: 'README.md',
        spans: ['docs/adr/', 'apps/web/node_modules', 'apps/api/dist/main.js'],
      },
    ];

    expect(missingPaths(spans, trackedPaths())).toEqual(['README.md: docs/adr']);
  });

  it('names only repo paths that exist or that a build writes', () => {
    const documents = checkedDocuments().map((document) => ({
      document,
      spans: markdownDocument(document).codeSpans,
    }));

    expect(missingPaths(documents, trackedPaths())).toEqual([]);
  });

  it('reads the packages a tree draws under their tier, and stops at the next top-level directory', () => {
    const tree = [
      'repo/',
      '├── apps/',
      '│   └── api/',
      '├── packages/',
      '│   ├── universal/',
      '│   │   └── result/          # Result',
      '│   └── server/',
      '│       ├── logger/',
      '│       └── db/',
      '└── infra/',
      '    └── compose/',
    ].join('\n');

    expect(packagesInTree(tree)).toEqual([
      'packages/universal/result',
      'packages/server/logger',
      'packages/server/db',
    ]);
  });

  it('draws every workspace package in the README tree, and only those', () => {
    const packages = trackedFiles(':(glob)packages/*/*/package.json').map(posix.dirname);

    expect(packagesInTree(readmeTree()).sort()).toEqual(packages.sort());
  });
});
