import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { read, trackedFiles } from './repo-files';

/** The e2e runners poll a deployed stack on its own clock, so only the e2e specs are read. */
const SPEC_FILES = [
  ':(glob)apps/**/*.test.ts',
  ':(glob)apps/**/*.test.tsx',
  ':(glob)apps/**/__tests__/**/*.ts',
  ':(glob)apps/**/__tests__/**/*.tsx',
  ':(glob)packages/**/*.test.ts',
  ':(glob)packages/**/*.test.tsx',
  ':(glob)packages/**/__tests__/**/*.ts',
  ':(glob)tests/architecture/**/*.ts',
  ':(glob)tests/in-process/**/*.ts',
  ':(glob)tests/**/*.test.ts',
];

const TEST_CALLS = new Set(['it', 'test', 'describe', 'suite']);
const EXCLUSIVE_MODIFIERS = new Set(['skip', 'only', 'todo', 'skipIf', 'runIf']);
const SLEEP_NAMES = new Set(['sleep', 'settle', 'delay']);
const TIMER_WAITS = new Set(['setTimeout', 'setImmediate']);
const CLOCKS = new Set(['Date.now', 'performance.now']);

interface Rule {
  name: string;
  /** Every node of one file, walked once and shared by the rules. */
  offenders: (nodes: readonly ts.Node[]) => ts.Node[];
}

function descendants(node: ts.Node): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (child: ts.Node): void => {
    found.push(child);
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

/** `a.b.c` for a chain of plain names, `undefined` for anything else. */
function dottedName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const base = dottedName(expression.expression);
  return base === undefined ? undefined : `${base}.${expression.name.text}`;
}

function calleeName(call: ts.CallExpression): string {
  return dottedName(call.expression) ?? '';
}

function isRuntimeVitestImport(node: ts.Node): boolean {
  if (!ts.isImportDeclaration(node)) return false;
  if (!ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== 'vitest') {
    return false;
  }
  const clause = node.importClause;
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  const bindings = clause.namedBindings;
  if (bindings === undefined || ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some((element) => !element.isTypeOnly);
}

function isTimerWait(node: ts.Node): boolean {
  if (!ts.isNewExpression(node) || dottedName(node.expression) !== 'Promise') return false;
  const executor = node.arguments?.[0];
  if (executor === undefined) return false;
  return descendants(executor).some(
    (child) => ts.isCallExpression(child) && TIMER_WAITS.has(calleeName(child))
  );
}

function isSleepHelper(node: ts.Node): boolean {
  if (ts.isFunctionDeclaration(node) && node.name) return SLEEP_NAMES.has(node.name.text);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    return SLEEP_NAMES.has(node.name.text);
  }
  return false;
}

function isClockRead(node: ts.Node | undefined): boolean {
  return node !== undefined && ts.isCallExpression(node) && CLOCKS.has(calleeName(node));
}

function clockSnapshots(nodes: readonly ts.Node[]): Set<string> {
  const names = new Set<string>();
  for (const node of nodes) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (isClockRead(node.initializer)) names.add(node.name.text);
    }
  }
  return names;
}

function elapsedTimeReads(nodes: readonly ts.Node[]): ts.Node[] {
  const snapshots = clockSnapshots(nodes);
  return nodes.filter(
    (node) =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.MinusToken &&
      isClockRead(node.left) &&
      ts.isIdentifier(node.right) &&
      snapshots.has(node.right.text)
  );
}

function isTypedModuleImport(node: ts.Node): boolean {
  if (ts.isImportTypeNode(node)) return node.isTypeOf;
  return (
    ts.isCallExpression(node) &&
    calleeName(node) === 'importOriginal' &&
    node.typeArguments !== undefined
  );
}

function testCallName(call: ts.CallExpression): string | undefined {
  let callee: ts.Expression = call.expression;
  while (ts.isCallExpression(callee) || ts.isPropertyAccessExpression(callee)) {
    callee = callee.expression;
  }
  return ts.isIdentifier(callee) ? callee.text : undefined;
}

function isExclusiveModifier(node: ts.Node): boolean {
  if (!ts.isPropertyAccessExpression(node)) return false;
  if (!EXCLUSIVE_MODIFIERS.has(node.name.text)) return false;
  const base = node.expression;
  return ts.isIdentifier(base) && TEST_CALLS.has(base.text);
}

function isConsoleCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && calleeName(node).startsWith('console.');
}

function titleOf(call: ts.CallExpression): string | undefined {
  const title = call.arguments[0];
  if (title === undefined) return undefined;
  if (ts.isStringLiteralLike(title)) return title.text;
  if (ts.isTemplateExpression(title)) return title.getText();
  return undefined;
}

/** The title a reporter prints: every enclosing `describe` title, then the test's own. */
function fullTitle(call: ts.CallExpression): string | undefined {
  const own = titleOf(call);
  if (own === undefined) return undefined;
  const path = [own];
  let parent: ts.Node | undefined = call.parent;
  while (parent !== undefined) {
    if (ts.isCallExpression(parent) && testCallName(parent) === 'describe') {
      path.unshift(titleOf(parent) ?? '');
    }
    parent = parent.parent;
  }
  return path.join(' > ');
}

function repeatedTitles(nodes: readonly ts.Node[]): ts.Node[] {
  const seen = new Set<string>();
  const repeats: ts.Node[] = [];
  for (const node of nodes) {
    if (!ts.isCallExpression(node)) continue;
    const name = testCallName(node);
    if (name !== 'it' && name !== 'test') continue;
    const title = fullTitle(node);
    if (title === undefined) continue;
    if (seen.has(title)) repeats.push(node);
    seen.add(title);
  }
  return repeats;
}

function matching(predicate: (node: ts.Node) => boolean): Rule['offenders'] {
  return (nodes) => nodes.filter(predicate);
}

const RULES: Rule[] = [
  { name: 'imports a runtime value from vitest', offenders: matching(isRuntimeVitestImport) },
  { name: 'waits on a timer', offenders: matching(isTimerWait) },
  { name: 'declares a sleep helper', offenders: matching(isSleepHelper) },
  { name: 'reads elapsed wall-clock time', offenders: elapsedTimeReads },
  { name: 'types a module import', offenders: matching(isTypedModuleImport) },
  { name: 'repeats a test title', offenders: repeatedTitles },
  { name: 'logs to the console', offenders: matching(isConsoleCall) },
  { name: 'skips or narrows the run', offenders: matching(isExclusiveModifier) },
];

function violations(path: string, source: string): string[] {
  const file = parseSource(path, source);
  const nodes = descendants(file);
  return RULES.flatMap((rule) =>
    rule.offenders(nodes).map((node) => {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart());
      return `${path}:${line + 1}: ${rule.name}`;
    })
  );
}

function ruleNames(source: string): string[] {
  return violations('fixture.test.ts', source).map((found) => found.split(': ')[1] ?? '');
}

describe('architecture: spec discipline', () => {
  it.each([
    ["import { describe, expect } from 'vitest';", 'imports a runtime value from vitest'],
    ["import * as v from 'vitest';", 'imports a runtime value from vitest'],
    ['await new Promise((resolve) => setTimeout(resolve, 20));', 'waits on a timer'],
    ['await new Promise((resolve) => setImmediate(resolve));', 'waits on a timer'],
    ['const settle = () => Promise.resolve();', 'declares a sleep helper'],
    ['async function sleep(ms: number) {}', 'declares a sleep helper'],
    [
      'const start = Date.now(); await run(); expect(Date.now() - start).toBeLessThan(50);',
      'reads elapsed wall-clock time',
    ],
    [
      'const t0 = performance.now(); expect(performance.now() - t0).toBeGreaterThan(1);',
      'reads elapsed wall-clock time',
    ],
    ["type M = typeof import('./module');", 'types a module import'],
    ['const real = await importOriginal<Module>();', 'types a module import'],
    ["it('does a thing', () => {}); it('does a thing', () => {});", 'repeats a test title'],
    ["describe('a', () => { it('x', () => {}); it('x', () => {}); });", 'repeats a test title'],
    ["console.log('here');", 'logs to the console'],
    ["it.skip('later', () => {});", 'skips or narrows the run'],
    ["describe.only('focus', () => {});", 'skips or narrows the run'],
    ["it.todo('someday');", 'skips or narrows the run'],
    ["it.skipIf(ci)('locally', () => {});", 'skips or narrows the run'],
    ["describe.runIf(ci)('in ci', () => {});", 'skips or narrows the run'],
  ])('fires on %s', (source, rule) => {
    expect(ruleNames(source)).toEqual([rule]);
  });

  it.each([
    ["import type { Mock } from 'vitest';"],
    ["import { type Mock } from 'vitest';"],
    ["import { defineConfig } from 'vitest/config';"],
    ["if (signal === 'SIGTERM') setImmediate(handler);"],
    ['const since = new Date(Date.now() - 3_600_000);'],
    ["vi.spyOn(console, 'error');"],
    ["it.each([1, 2])('reads %s', () => {}); it('reads one', () => {});"],
    ["describe('a', () => { it('x', () => {}); }); describe('b', () => { it('y', () => {}); });"],
  ])('lets %s through', (source) => {
    expect(ruleNames(source)).toEqual([]);
  });

  it('holds every spec and test helper in the repo', () => {
    const found = trackedFiles(...SPEC_FILES).flatMap((path) => violations(path, read(path)));

    expect(found).toEqual([]);
  });
});
