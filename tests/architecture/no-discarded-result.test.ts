import { relative } from 'node:path';
import ts from 'typescript';
import { fixtureProgram, productionProgram } from './program';
import { ROOT } from './repo-files';

/**
 * ADR-24 says a failure is returned; this is what says somebody reads it. A statement whose value
 * is a `Result`, or a promise of one, has dropped it. `ignore(result, reason)` is the only way to
 * say that was meant, and it types as `void`, so it never reaches this check.
 */
function isResult(checker: ts.TypeChecker, type: ts.Type): boolean {
  const members = type.isUnion() ? type.types : [type];
  return members.every(
    (member) =>
      member.getProperty('ok') !== undefined &&
      (member.getProperty('value') !== undefined || member.getProperty('error') !== undefined) &&
      !(checker.getTypeOfSymbol(member.getProperty('ok') as ts.Symbol).flags & ts.TypeFlags.Any)
  );
}

const DISCARDING_METHODS = new Set(['catch', 'finally']);

/** `await`, `void`, parentheses and a trailing `.catch()`/`.finally()` all still drop the value. */
function discardedExpression(expression: ts.Expression): ts.Expression {
  if (ts.isAwaitExpression(expression) || ts.isVoidExpression(expression)) {
    return discardedExpression(expression.expression);
  }
  if (ts.isParenthesizedExpression(expression)) return discardedExpression(expression.expression);
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    DISCARDING_METHODS.has(expression.expression.name.text)
  ) {
    return discardedExpression(expression.expression.expression);
  }
  return expression;
}

function isAssignment(expression: ts.Expression): boolean {
  return (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    expression.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  );
}

function discards(program: ts.Program, files: readonly ts.SourceFile[]): string[] {
  const checker = program.getTypeChecker();
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isExpressionStatement(node) && !isAssignment(node.expression)) {
      const expression = discardedExpression(node.expression);
      const type = checker.getAwaitedType(checker.getTypeAtLocation(expression));
      if (type && isResult(checker, checker.getNonNullableType(type))) {
        const file = node.getSourceFile();
        const { line } = file.getLineAndCharacterOfPosition(node.getStart());
        found.push(
          `${relative(ROOT, file.fileName)}:${line + 1}: ${node.getText().split('\n')[0]}`
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  for (const file of files) visit(file);
  return found;
}

const FIXTURE = {
  '/fixture/result.ts': [
    'export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };',
    'export declare function ignore<S extends string>(r: unknown, reason: S): void;',
  ].join('\n'),
  '/fixture/stage.ts': [
    "import { type Result, ignore } from './result';",
    'declare const repo: { remove(): Promise<Result<void, { code: "DATABASE_UNAVAILABLE" }>> };',
    'declare function check(): Result<number, string>;',
    'export async function run(): Promise<void> {',
    '  await repo.remove();',
    '  void repo.remove();',
    '  repo.remove().catch(() => {});',
    '  check();',
    '  ignore(await repo.remove(), "the cache is advisory");',
    '  const kept = await repo.remove();',
    '  if (!kept.ok) return;',
    '  let later: Result<void, unknown> | undefined;',
    '  later ??= await repo.remove();',
    '}',
  ].join('\n'),
};

describe('architecture: no Result is dropped without ignore()', () => {
  it.each([
    { shape: 'a bare await', line: 5 },
    { shape: 'a void', line: 6 },
    { shape: 'a .catch()', line: 7 },
    { shape: 'a synchronous call', line: 8 },
  ])('recognises $shape', ({ line }) => {
    const program = fixtureProgram(FIXTURE);
    const stage = program.getSourceFile('/fixture/stage.ts') as ts.SourceFile;

    expect(discards(program, [stage]).map((hit) => hit.split(':')[1])).toContain(String(line));
  });

  it('leaves an ignore(), a read result and an assigned one alone', () => {
    const program = fixtureProgram(FIXTURE);
    const stage = program.getSourceFile('/fixture/stage.ts') as ts.SourceFile;

    expect(discards(program, [stage])).toHaveLength(4);
  });

  it('finds no dropped Result in production source', () => {
    const { program, roots } = productionProgram();
    const files = program.getSourceFiles().filter((file) => roots.has(file.fileName));

    expect(files.length).toBeGreaterThan(400);
    expect(discards(program, files)).toEqual([]);
  });
});
