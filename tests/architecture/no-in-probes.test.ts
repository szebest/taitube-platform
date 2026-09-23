import ts from 'typescript';
import { productionSources, read } from './repo-files';

/**
 * `'field' in value` narrows on the presence of a key, which a new member of the union can share
 * without anyone noticing. Our own unions carry one literal `type` and switch on it exhaustively;
 * a value we do not own is parsed through a schema, or unwrapped into a `Result`.
 */
function inProbes(file: string, source: string): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
      ts.isStringLiteralLike(node.left)
    ) {
      found.push(`${file}: ${node.getText()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

describe("architecture: no 'literal' in value narrowing", () => {
  it.each([
    { shape: 'a key probe', source: "if ('rendition' in child) use(child.rendition);" },
    { shape: 'a probe on a result', source: 'const ok = "data" in response;' },
    { shape: 'a probe in JSX', source: "const x = <A>{'do' in props ? 1 : 2}</A>;" },
  ])('recognises $shape', ({ source }) => {
    expect(inProbes('fixture.tsx', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a record lookup by a variable', source: 'const known = code in RETRY_CLASS;' },
    { shape: 'a for-in loop', source: 'for (const key in record) use(key);' },
  ])('leaves $shape alone', ({ source }) => {
    expect(inProbes('fixture.ts', source)).toEqual([]);
  });

  it('finds none in production source, the browser tier included', () => {
    expect(productionSources().flatMap((file) => inProbes(file, read(file)))).toEqual([]);
  });
});
