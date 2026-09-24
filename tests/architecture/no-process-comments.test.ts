import ts from 'typescript';
import { read, trackedFiles } from './repo-files';

const SOURCES = [
  ':(glob)apps/**/*.ts',
  ':(glob)apps/**/*.tsx',
  ':(glob)apps/**/*.js',
  ':(glob)packages/**/*.ts',
  ':(glob)packages/**/*.tsx',
  ':(glob)packages/**/*.mts',
  ':(glob)packages/**/*.mjs',
  ':(glob)packages/**/*.js',
  ':(glob)scripts/**/*.ts',
  ':(glob)tests/**/*.ts',
  ':(glob)tests/**/*.js',
  ':(exclude,glob)apps/web/public/**',
];

/**
 * A work item is not a reason: once it closes, the reference points at nothing. `ADR-NN` and
 * `SDD §` stay allowed, because they name a decision that outlives the work that made it.
 */
const WORK_ITEM = /\bACs?\b|\bAC[ -]?\d+|\b[Tt]ickets?\b|#\d{2,}\b|\b[Ss]tep \d+|\bW\d{1,2}\b/;
const NUMBERED_STEP = /^\s*(?:\/\/+|\/\*+|\*)?\s*\(?\d+[.)]\s/m;
const TEST_CALL = /^(?:it|test|describe|suite|bench)$/;

function comments(file: ts.SourceFile): string[] {
  const text = file.getFullText();
  const seen = new Map<number, string>();
  const collect = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) seen.set(range.pos, text.slice(range.pos, range.end));
  };
  const visit = (node: ts.Node) => {
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(file)) visit(child);
  };
  visit(file);
  return [...seen.values()];
}

function testCallee(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return testCallee(expression.expression);
  if (ts.isCallExpression(expression)) return testCallee(expression.expression);
  return undefined;
}

function testTitles(file: ts.SourceFile): string[] {
  const titles: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const [title] = node.arguments;
      const callee = testCallee(node.expression);
      if (title && callee && TEST_CALL.test(callee) && ts.isStringLiteralLike(title)) {
        titles.push(title.text);
      } else if (title && callee && TEST_CALL.test(callee) && ts.isTemplateExpression(title)) {
        titles.push(title.getText(file));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return titles;
}

function processReferences(name: string, source: string): string[] {
  if (!(WORK_ITEM.test(source) || NUMBERED_STEP.test(source))) return [];
  const kind = name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind);
  return [
    ...comments(file).filter((comment) => WORK_ITEM.test(comment) || NUMBERED_STEP.test(comment)),
    ...testTitles(file).filter((title) => WORK_ITEM.test(title)),
  ];
}

describe('architecture: no work-item references in code, specs or test titles', () => {
  it.each([
    ['a ticket in a comment', '// Ticket 17: soft delete\nconst a = 1;'],
    ['an AC in a comment', 'const a = 1; // AC 3'],
    ['a numbered step', 'function f() {\n  // 2. Setup workers\n  return 1;\n}'],
    ['a step reference', '/* Step 4 of the reconciler */\nexport {};'],
    ['a PR reference', '// landed in #104\nexport {};'],
    ['a workstream', '// W7 owns this\nexport {};'],
    ['an AC in a test title', "it('AC 1: rejects a stale token', () => {});"],
    ['a ticket in a describe', "describe('Outbox relay (Ticket 30)', () => {});"],
    ['an AC in an it.each title', "it.each([1])('AC 2: case %s', () => {});"],
    ['a comment before a closing brace', 'function f() {\n  return 1;\n  // AC 5\n}'],
  ])('fires on %s', (_name, source) => {
    expect(processReferences('fixture.test.ts', source)).not.toEqual([]);
  });

  it.each([
    ['an ADR reference', '// ADR-24: the edge decides\nexport {};'],
    ['an SDD section', '// SDD §6.2 owns the vocabulary\nexport {};'],
    [
      'a string that is not a comment or a title',
      "const url = 'https://x.test/#12'; const a = 'AC 1';",
    ],
    ['a hex colour', "const colour = '#000000';"],
    ['a plain test title', "it('rejects a stale token', () => {});"],
  ])('passes %s', (_name, source) => {
    expect(processReferences('fixture.test.ts', source)).toEqual([]);
  });

  it('finds none in production source, specs or tests', () => {
    const files = trackedFiles(...SOURCES);
    const offenders = files.flatMap((file) =>
      processReferences(file, read(file)).map((found) => `${file}: ${found.trim().slice(0, 80)}`)
    );

    expect(files.length).toBeGreaterThan(900);
    expect(offenders).toEqual([]);
  });
});
