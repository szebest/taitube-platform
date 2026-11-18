import { join } from 'node:path';
import ts from 'typescript';
import { load } from '../../scripts/workspace-packages';
import { productionProgram } from './program';
import { read, ROOT } from './repo-files';

type EntryMove = string | Readonly<Record<string, string>>;
type PackageMove = string | Readonly<Record<string, EntryMove>>;
type Moves = Readonly<Record<string, PackageMove>>;

interface Workspace {
  entriesOf: (name: string) => string[] | undefined;
  exportsOf: (specifier: string) => string[];
}

const sorted = (names: Iterable<string>) => [...names].sort();

const difference = (left: readonly string[], right: readonly string[]) =>
  left.filter((name) => !right.includes(name));

function exportedAt(workspace: Workspace, destination: string, symbol: string): boolean {
  return workspace.exportsOf(destination).includes(symbol);
}

function landedDrift(name: string, move: PackageMove, workspace: Workspace): string[] {
  if (typeof move === 'string') {
    return workspace.entriesOf(move) ? [] : [`${name}: no workspace package has this name`];
  }
  const missing = Object.values(move).flatMap((entry) =>
    typeof entry === 'string'
      ? []
      : Object.entries(entry).filter(
          ([symbol, destination]) => !exportedAt(workspace, destination, symbol)
        )
  );
  return missing.length === 0
    ? []
    : missing.map(
        ([symbol, destination]) => `${name}: ${symbol} is not exported by ${destination}`
      );
}

function moveDrift(moves: Moves, workspace: Workspace): string[] {
  return Object.entries(moves).flatMap(([name, move]) => {
    const entries = workspace.entriesOf(name);
    if (!entries) return landedDrift(name, move, workspace);
    if (typeof move === 'string') return [];

    const listed = Object.keys(move);
    const entryDrift = [
      ...difference(entries, listed).map((entry) => `${name}: export entry ${entry} is not listed`),
      ...difference(listed, entries).map(
        (entry) => `${name}: lists ${entry}, which it no longer exports`
      ),
    ];
    const nameDrift = Object.entries(move).flatMap(([entry, entryMove]) => {
      if (typeof entryMove === 'string' || !entries.includes(entry)) return [];
      const specifier = entry === '.' ? name : `${name}/${entry.slice(2)}`;
      const exported = workspace.exportsOf(specifier);
      const named = Object.keys(entryMove);
      const gone = named.filter(
        (symbol) =>
          !exported.includes(symbol) &&
          !(
            entryMove[symbol] !== name && exportedAt(workspace, entryMove[symbol] as string, symbol)
          )
      );
      return [
        ...difference(exported, named).map((n) => `${specifier}: export ${n} has no destination`),
        ...gone.map((n) => `${specifier}: lists ${n}, which it no longer exports`),
      ];
    });
    return [...entryDrift, ...nameDrift];
  });
}

function repoWorkspace(): Workspace {
  const manifests = new Map(
    load().map(({ name, dir }) => [
      name,
      JSON.parse(read(join(dir, 'package.json'))) as { exports?: Record<string, unknown> },
    ])
  );
  const { program } = productionProgram();
  const checker = program.getTypeChecker();
  const from = join(ROOT, 'package.json');

  return {
    entriesOf: (name) => {
      const manifest = manifests.get(name);
      return (
        manifest && sorted(Object.keys(manifest.exports ?? {}).filter((e) => !e.includes('*')))
      );
    },
    exportsOf: (specifier) => {
      const { resolvedModule } = ts.resolveModuleName(
        specifier,
        from,
        program.getCompilerOptions(),
        ts.sys
      );
      const source = resolvedModule && program.getSourceFile(resolvedModule.resolvedFileName);
      const symbol = source && checker.getSymbolAtLocation(source);
      return symbol ? sorted(checker.getExportsOfModule(symbol).map((e) => e.name)) : [];
    },
  };
}

const PLANTED: Workspace = {
  entriesOf: (name) =>
    name === '@vp/split' ? ['.', './extra'] : name === '@kit/landed' ? ['.'] : undefined,
  exportsOf: (specifier) => (specifier === '@kit/landed' ? ['moved'] : ['kept', 'added']),
};

describe('architecture: package moves', () => {
  it('gives every export of a split package a destination, and names only what exists', () => {
    const moves = JSON.parse(read('scripts/package-moves.json')) as Moves;

    expect(moveDrift(moves, repoWorkspace())).toEqual([]);
  });

  it.each<{ planted: string; moves: Moves; drift: string[] }>([
    {
      planted: 'a package that does not exist',
      moves: { '@vp/gone': '@kit/gone' },
      drift: ['@vp/gone: no workspace package has this name'],
    },
    {
      planted: 'an unlisted entry, an added export and a removed one',
      moves: { '@vp/split': { '.': { kept: '@kit/split', removed: '@vp/split' } } },
      drift: [
        '@vp/split: export entry ./extra is not listed',
        '@vp/split: export added has no destination',
        '@vp/split: lists removed, which it no longer exports',
      ],
    },
  ])('reports $planted', ({ moves, drift }) => {
    expect(moveDrift(moves, PLANTED)).toEqual(drift);
  });

  it('accepts a symbol that has left a split package for a destination that exports it', () => {
    const moves: Moves = {
      '@vp/split': {
        '.': { kept: '@vp/split', added: '@vp/split', moved: '@kit/landed' },
        './extra': '@vp/split',
      },
    };

    expect(moveDrift(moves, PLANTED)).toEqual([]);
  });

  it('accepts a split package that has landed, its symbols all at their destinations', () => {
    expect(moveDrift({ '@vp/old': { '.': { moved: '@kit/landed' } } }, PLANTED)).toEqual([]);
  });

  it('reports a symbol of a landed split that its destination does not export', () => {
    const moves: Moves = { '@vp/old': { '.': { moved: '@kit/landed', ghost: '@kit/landed' } } };

    expect(moveDrift(moves, PLANTED)).toEqual(['@vp/old: ghost is not exported by @kit/landed']);
  });

  it('accepts a whole move that has landed, its old name gone and its new one present', () => {
    expect(moveDrift({ '@vp/landed': '@kit/landed' }, PLANTED)).toEqual([]);
  });
});
