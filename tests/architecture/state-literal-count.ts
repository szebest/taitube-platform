import ts from 'typescript';
import { parseSource } from './parsed-sources';

const STATE_PROPERTIES = new Set(['status', 'phase', 'state']);
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const isStateRead = (node: ts.Node): boolean =>
  ts.isPropertyAccessExpression(node) && STATE_PROPERTIES.has(node.name.text);

/**
 * The places a `.status`, `.phase` or `.state` is compared with a string literal or switched on: the
 * branching a `defineMachine` table replaces. A `*.machine.ts` file is the table, so it has none to count.
 */
export function countStateLiteralCompares(file: string, source: string): number {
  if (file.endsWith('.machine.ts')) return 0;

  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      COMPARISONS.has(node.operatorToken.kind) &&
      ((isStateRead(node.left) && ts.isStringLiteralLike(node.right)) ||
        (isStateRead(node.right) && ts.isStringLiteralLike(node.left)))
    ) {
      count += 1;
    }
    if (ts.isSwitchStatement(node) && isStateRead(node.expression)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return count;
}
