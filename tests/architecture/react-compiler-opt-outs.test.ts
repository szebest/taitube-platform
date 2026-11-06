import ts from 'typescript';
import { read, trackedFiles } from './repo-files';
import { MANUAL_MEMO_ALLOWLIST } from './zero-matches-react-rows';

const BASELINE = 'tests/react-compiler/baseline.json';
const OPT_OUTS = new Set(['use no memo', 'use no forget']);
const ISSUE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;

type BaselineEntry = { reason: string; issue: string };

const baseline: Record<string, BaselineEntry> = JSON.parse(read(BASELINE));

function prologue(statements: ts.NodeArray<ts.Statement>): string[] {
  const directives: string[] = [];
  for (const statement of statements) {
    if (!(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression))) break;
    directives.push(statement.expression.text);
  }
  return directives;
}

function directivesIn(file: string): string[] {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, false);
  const found = prologue(source.statements);
  const visit = (node: ts.Node) => {
    const isFunction =
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node);
    if (isFunction && node.body !== undefined && ts.isBlock(node.body)) {
      found.push(...prologue(node.body.statements));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('architecture: React Compiler opt-outs', () => {
  it('lets a "use no memo" directive stand only in a file the baseline lists', () => {
    const optedOut = trackedFiles(
      ':(glob)apps/client/**/*.ts',
      ':(glob)apps/client/**/*.tsx',
      ':(glob)packages/client/**/*.ts',
      ':(glob)packages/client/**/*.tsx'
    ).filter((file) => directivesIn(file).some((directive) => OPT_OUTS.has(directive)));

    expect(optedOut.length).toBeGreaterThan(0);
    expect(optedOut.filter((file) => baseline[file] === undefined)).toEqual([]);
  });

  it('gives every baseline entry a tracked file, a reason and an issue link', () => {
    const tracked = new Set(trackedFiles(...Object.keys(baseline)));
    const broken = Object.entries(baseline).filter(
      ([file, { reason, issue }]) =>
        !tracked.has(file) || reason.trim() === '' || !ISSUE.test(issue)
    );

    expect(broken.map(([file]) => file)).toEqual([]);
  });

  it('keeps a manual memo allowlist entry only while its file memoizes, with a reason', () => {
    const stale = Object.entries(MANUAL_MEMO_ALLOWLIST).filter(
      ([file, reason]) =>
        reason.trim() === '' ||
        trackedFiles(file).length === 0 ||
        !/\b(?:useMemo|useCallback|memo)\s*[<(]/.test(read(file))
    );

    expect(stale.map(([file]) => file)).toEqual([]);
  });
});
