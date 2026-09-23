import ts from 'typescript';
import { productionSources, read } from './repo-files';

const ROOTS = [
  'apps/api/src/services/',
  'apps/worker/src/',
  'packages/server/adapters/',
  'packages/server/ffmpeg/src/',
];

/** `?? 0` and `?? 1` say "none" and "one", not how much: they are not tuning. */
const IDENTITY = new Set([0, 1]);

function numericValue(node: ts.Expression): number | undefined {
  if (ts.isParenthesizedExpression(node)) return numericValue(node.expression);
  if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/g, ''));
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const operand = numericValue(node.operand);
    return operand === undefined ? undefined : -operand;
  }
  if (ts.isBinaryExpression(node)) {
    const left = numericValue(node.left);
    const right = numericValue(node.right);
    if (left === undefined || right === undefined) return undefined;
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.AsteriskToken:
        return left * right;
      case ts.SyntaxKind.PlusToken:
        return left + right;
      case ts.SyntaxKind.MinusToken:
        return left - right;
      case ts.SyntaxKind.SlashToken:
        return left / right;
      default:
        return undefined;
    }
  }
  return undefined;
}

function isTuning(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  const value = numericValue(node);
  return value !== undefined && !IDENTITY.has(value);
}

function tuningLiterals(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const report = (node: ts.Node, shape: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${file}:${line + 1} ${shape}: ${node.getText().replace(/\s+/g, ' ')}`);
  };

  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      isTuning(node.right)
    ) {
      report(node, 'fallback');
    }
    if (ts.isBindingElement(node) && isTuning(node.initializer)) report(node, 'destructuring');
    if (ts.isParameter(node) && isTuning(node.initializer)) report(node, 'parameter');
    ts.forEachChild(node, visit);
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (isTuning(declaration.initializer)) report(declaration, 'module constant');
    }
  }
  visit(sourceFile);
  return found;
}

describe('architecture: tuning values live in AppConfig', () => {
  it.each([
    { shape: 'fallback', source: 'const ttl = options.ttlMs ?? 3600;' },
    { shape: 'fallback', source: 'const ttl = deps.ttlMs ?? 5 * 60 * 1000;' },
    { shape: 'destructuring', source: 'const { concurrency = 4 } = deps;' },
    { shape: 'parameter', source: 'function poll(intervalMs = 15_000) {}' },
    { shape: 'module constant', source: 'export const QUEUE_POLL_INTERVAL_MS = 5_000;' },
    { shape: 'module constant', source: 'const STALE_STEP_MS = 5 * 60 * 1000;' },
  ])('recognises a numeric default as a $shape', ({ shape, source }) => {
    expect(tuningLiterals('fixture.ts', source)).toEqual([expect.stringContaining(shape)]);
  });

  it.each([
    'const views = video.viewsCount ?? 0;',
    'const attempt = job.attemptsMade ?? 1;',
    'const { limit = DEFAULT_LIMIT } = options;',
    "const name = options.name ?? 'probe';",
  ])('lets %s through', (source) => {
    expect(tuningLiterals('fixture.ts', source)).toEqual([]);
  });

  it('finds no numeric default in services, stages or adapters', () => {
    const offenders = productionSources()
      .filter((file) => ROOTS.some((root) => file.startsWith(root)))
      .flatMap((file) => tuningLiterals(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
