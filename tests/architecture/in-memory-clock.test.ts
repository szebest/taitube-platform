import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

const CLOCK_OWNER = 'packages/server/adapters/in-memory/repositories/clock.ts';

function dateNowReads(file: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Date' &&
      node.name.text === 'now'
    ) {
      found.push(`${file}: reads Date.now()`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return found;
}

describe('architecture: an in-memory repository tells time from its injected clock', () => {
  it('fires on a Date.now() call or reference, and passes a clock read', () => {
    const planted = [
      'const expired = (row: Row) => row.expiresAt.getTime() < Date.now();',
      'constructor(private readonly now = Date.now) {}',
      'const live = (row: Row) => row.expiresAt.getTime() > this.now();',
      'const stamp = new Date(this.now());',
    ].join('\n');

    expect(dateNowReads('in-memory-things.ts', planted)).toEqual([
      'in-memory-things.ts: reads Date.now()',
      'in-memory-things.ts: reads Date.now()',
    ]);
  });

  it('finds Date.now() only in the clock that every repository double defaults to', () => {
    const files = trackedFiles(
      ':(glob)packages/server/adapters/in-memory/repositories/**/*.ts'
    ).filter((file) => !file.includes('__tests__') && file !== CLOCK_OWNER);

    expect(files.length).toBeGreaterThan(20);
    expect(files.flatMap((file) => dateNowReads(file, read(file)))).toEqual([]);
  });
});
