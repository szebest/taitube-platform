import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

const COLLECTIONS = new Set(['Map', 'Set']);

function holdsCollection(member: ts.ClassElement): boolean {
  if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) return false;
  const initializer = member.initializer;
  if (ts.isArrayLiteralExpression(initializer)) return true;
  return (
    ts.isNewExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    COLLECTIONS.has(initializer.expression.text)
  );
}

function hasClear(node: ts.ClassDeclaration): boolean {
  return node.members.some(
    (member) =>
      ts.isMethodDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === 'clear'
  );
}

/** Each in-memory class that keeps a collection and has no `clear()` to empty it. */
function doublesWithoutClear(file: string, source: string): string[] {
  return parseSource(file, source)
    .statements.filter(ts.isClassDeclaration)
    .filter((node) => node.members.some(holdsCollection) && !hasClear(node))
    .map((node) => `${file}: ${node.name?.text ?? 'anonymous class'}`);
}

describe('architecture: an in-memory double owns its state and can empty it', () => {
  it('fires on a double that keeps a Map with no clear(), and passes a stateless one', () => {
    const planted = [
      'export class InMemoryThings { private readonly things = new Map<string, string>(); }',
      'export class InMemoryList { private items: string[] = []; clear() { this.items = []; } }',
      'export class InMemoryPort { async checkHealth() { return true; } }',
    ].join('\n');

    expect(doublesWithoutClear('in-memory-things.ts', planted)).toEqual([
      'in-memory-things.ts: InMemoryThings',
    ]);
  });

  it('finds a clear() on every in-memory double that keeps state', () => {
    const files = trackedFiles(':(glob)packages/server/adapters/in-memory/**/*.ts').filter(
      (file) => !file.includes('__tests__')
    );

    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap((file) => doublesWithoutClear(file, read(file)))).toEqual([]);
  });
});
