import ts from 'typescript';
import { ENTRYPOINTS, isListed } from './entrypoints';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * Values a module may build once and share, because nothing can change them afterwards. A `Map`
 * or a `Set` qualifies only when its declared type says `Readonly`, which is what stops the next
 * `cache.set(...)` from turning a lookup table into state.
 */
const IMMUTABLE_VALUES = new Set(['RegExp', 'URL', 'TextEncoder', 'TextDecoder', 'Intl']);
const READONLY_COLLECTIONS = /^Readonly(Map|Set)</;

type Shape = 'mutable binding' | 'stateful instance' | 'top-level call';

function constructedName(node: ts.NewExpression): string {
  return ts.isPropertyAccessExpression(node.expression)
    ? (node.expression.getText().split('.')[0] ?? '')
    : node.expression.getText();
}

function statefulConstructions(declaration: ts.VariableDeclaration): ts.NewExpression[] {
  const found: ts.NewExpression[] = [];
  const readonlyCollection = READONLY_COLLECTIONS.test(declaration.type?.getText() ?? '');

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return;
    if (ts.isNewExpression(node)) {
      const name = constructedName(node);
      const isCollection = name === 'Map' || name === 'Set';
      if (!(IMMUTABLE_VALUES.has(name) || (isCollection && readonlyCollection))) found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  if (declaration.initializer) visit(declaration.initializer);
  return found;
}

function isCall(expression: ts.Expression): boolean {
  if (ts.isAwaitExpression(expression) || ts.isVoidExpression(expression)) {
    return isCall(expression.expression);
  }
  return ts.isCallExpression(expression) || ts.isNewExpression(expression);
}

function moduleState(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const report = (node: ts.Node, shape: Shape) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${file}:${line + 1} ${shape}: ${node.getText().split('\n')[0]}`);
  };

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      if (!(statement.declarationList.flags & ts.NodeFlags.Const)) {
        report(statement, 'mutable binding');
      }
      for (const declaration of statement.declarationList.declarations) {
        for (const node of statefulConstructions(declaration)) report(node, 'stateful instance');
      }
    }
    if (ts.isExpressionStatement(statement) && isCall(statement.expression)) {
      report(statement, 'top-level call');
    }
  }
  return found;
}

describe('architecture: no module-level state outside an entrypoint', () => {
  it.each([
    { shape: 'a module-scope let', source: 'let cache: string | null = null;' },
    { shape: 'a module-scope var', source: 'var count = 0;' },
    { shape: 'a shared instance', source: 'export const paginator = new Paginator();' },
    { shape: 'a writable map', source: 'const byId = new Map<string, number>();' },
    { shape: 'an import-time call', source: 'collectDefaultMetrics({ register });' },
    { shape: 'an awaited import-time call', source: 'await connect();' },
  ])('recognises $shape', ({ source }) => {
    expect(moduleState('fixture.ts', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a readonly lookup', source: "const SEEN: ReadonlySet<string> = new Set(['a']);" },
    { shape: 'a pattern', source: 'const SLUG = new RegExp("^[a-z]+$");' },
    { shape: 'a frozen value', source: 'export const LIMITS = Object.freeze({ max: 1 });' },
    { shape: 'a factory', source: 'export const make = () => new Paginator();' },
    { shape: 'a class field', source: 'class A { private readonly m = new Map(); }' },
  ])('leaves $shape alone', ({ source }) => {
    expect(moduleState('fixture.ts', source)).toEqual([]);
  });

  it('finds none in production source outside ENTRYPOINTS', () => {
    const offenders = productionSources()
      .filter((file) => !isListed(file, ENTRYPOINTS))
      .flatMap((file) => moduleState(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
