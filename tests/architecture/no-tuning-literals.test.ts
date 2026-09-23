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

/**
 * Minutes, hours and days spelt as arithmetic. `@vp/domain/time` owns them, so a duration reads as
 * `retentionDays * MS_PER_DAY`, never as a literal chain written to get past the constant check.
 */
const COMPOUND_UNITS = new Set([60_000, 3_600_000, 86_400_000, 3_600, 86_400]);

function multiplicationFactors(node: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(node)) return multiplicationFactors(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
    return [...multiplicationFactors(node.left), ...multiplicationFactors(node.right)];
  }
  return [node];
}

function inlinesUnit(node: ts.Node): boolean {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.AsteriskToken) {
    return false;
  }
  let parent = node.parent;
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
  const insideChain =
    ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AsteriskToken;
  if (insideChain) return false;

  const literals = multiplicationFactors(node)
    .map(numericValue)
    .filter((value): value is number => value !== undefined);
  return literals.length > 0 && COMPOUND_UNITS.has(literals.reduce((a, b) => a * b, 1));
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
    if (inlinesUnit(node)) report(node, 'inlined unit, use @vp/domain/time');
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
    { shape: 'inlined unit', source: 'const cutoff = retentionDays * 24 * 60 * 60 * 1000;' },
    { shape: 'inlined unit', source: 'const ms = hours * 3600000;' },
    { shape: 'inlined unit', source: 'const cutoff = Date.now() - (days * 86_400_000);' },
    { shape: 'inlined unit', source: 'const ms = (days * 24 * 60 * 60 * 1000);' },
  ])('recognises $shape in $source', ({ shape, source }) => {
    expect(tuningLiterals('fixture.ts', source)).toEqual([expect.stringContaining(shape)]);
  });

  it.each([
    'const views = video.viewsCount ?? 0;',
    'const attempt = job.attemptsMade ?? 1;',
    'const { limit = DEFAULT_LIMIT } = options;',
    "const name = options.name ?? 'probe';",
    'const cutoff = retentionDays * MS_PER_DAY;',
    'const bps = (bytes * 8) / (durationMs / MS_PER_SECOND);',
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
