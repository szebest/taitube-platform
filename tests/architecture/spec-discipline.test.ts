import ts from 'typescript';
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
const TIMER_MODULES = new Set(['node:timers/promises', 'timers/promises']);
const CLOCKS = new Set(['Date.now', 'performance.now']);

interface ParsedSpec {
  file: ts.SourceFile;
  /** Every node of the file by its kind, walked once and shared by the rules. */
  byKind: ReadonlyMap<ts.SyntaxKind, readonly ts.Node[]>;
}

interface Rule {
  name: string;
  offenders: (spec: ParsedSpec) => ts.Node[];
}

function nodesByKind(file: ts.SourceFile): Map<ts.SyntaxKind, ts.Node[]> {
  const byKind = new Map<ts.SyntaxKind, ts.Node[]>();
  const visit = (node: ts.Node): void => {
    const sameKind = byKind.get(node.kind);
    if (sameKind === undefined) byKind.set(node.kind, [node]);
    else sameKind.push(node);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(file, visit);
  return byKind;
}

function ofKind(spec: ParsedSpec, kinds: readonly ts.SyntaxKind[]): ts.Node[] {
  return kinds.flatMap((kind) => spec.byKind.get(kind) ?? []);
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
  if (ts.isIdentifier(executor)) return TIMER_WAITS.has(executor.text);
  let waits = false;
  const visit = (child: ts.Node): void => {
    if (ts.isCallExpression(child) && TIMER_WAITS.has(calleeName(child))) waits = true;
    ts.forEachChild(child, visit);
  };
  visit(executor);
  return waits;
}

function isTimerImport(node: ts.Node): boolean {
  if (!ts.isImportDeclaration(node)) return false;
  if (!ts.isStringLiteral(node.moduleSpecifier)) return false;
  return TIMER_MODULES.has(node.moduleSpecifier.text);
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

function clockSnapshots(spec: ParsedSpec): Set<string> {
  const names = new Set<string>();
  for (const node of ofKind(spec, [ts.SyntaxKind.VariableDeclaration])) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (isClockRead(node.initializer)) names.add(node.name.text);
    }
  }
  return names;
}

function elapsedTimeReads(spec: ParsedSpec): ts.Node[] {
  const snapshots = clockSnapshots(spec);
  return ofKind(spec, [ts.SyntaxKind.BinaryExpression]).filter(
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

function titleOf(call: ts.CallExpression, file: ts.SourceFile): string | undefined {
  const title = call.arguments[0];
  if (title === undefined) return undefined;
  if (ts.isStringLiteralLike(title)) return title.text;
  if (ts.isTemplateExpression(title)) return title.getText(file);
  return undefined;
}

/** Each test with the title a reporter prints: every enclosing `describe` title, then its own. */
function testTitles(file: ts.SourceFile): { test: ts.Node; title: string }[] {
  const found: { test: ts.Node; title: string }[] = [];
  const visit = (node: ts.Node, describes: string[]): void => {
    let inside = describes;
    if (ts.isCallExpression(node)) {
      const name = testCallName(node);
      const title = titleOf(node, file);
      if (title !== undefined && name === 'describe') inside = [...describes, title];
      if (title !== undefined && (name === 'it' || name === 'test')) {
        found.push({ test: node, title: [...describes, title].join(' > ') });
      }
    }
    ts.forEachChild(node, (child) => visit(child, inside));
  };
  visit(file, []);
  return found;
}

function repeatedTitles({ file }: ParsedSpec): ts.Node[] {
  const seen = new Set<string>();
  const repeats: ts.Node[] = [];
  for (const { test, title } of testTitles(file)) {
    if (seen.has(title)) repeats.push(test);
    seen.add(title);
  }
  return repeats;
}

function matching(
  kinds: readonly ts.SyntaxKind[],
  predicate: (node: ts.Node) => boolean
): Rule['offenders'] {
  return (spec) => ofKind(spec, kinds).filter(predicate);
}

const { CallExpression, FunctionDeclaration, ImportDeclaration, ImportType, NewExpression } =
  ts.SyntaxKind;
const { PropertyAccessExpression, VariableDeclaration } = ts.SyntaxKind;

const RULES: Rule[] = [
  {
    name: 'imports a runtime value from vitest',
    offenders: matching([ImportDeclaration], isRuntimeVitestImport),
  },
  { name: 'waits on a timer', offenders: matching([NewExpression], isTimerWait) },
  { name: 'imports a timer to wait on', offenders: matching([ImportDeclaration], isTimerImport) },
  {
    name: 'declares a sleep helper',
    offenders: matching([FunctionDeclaration, VariableDeclaration], isSleepHelper),
  },
  { name: 'reads elapsed wall-clock time', offenders: elapsedTimeReads },
  {
    name: 'types a module import',
    offenders: matching([ImportType, CallExpression], isTypedModuleImport),
  },
  { name: 'repeats a test title', offenders: repeatedTitles },
  { name: 'logs to the console', offenders: matching([CallExpression], isConsoleCall) },
  {
    name: 'skips or narrows the run',
    offenders: matching([PropertyAccessExpression], isExclusiveModifier),
  },
];

function violations(path: string, source: string): string[] {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, kind);
  const spec = { file, byKind: nodesByKind(file) };
  return RULES.flatMap((rule) =>
    rule.offenders(spec).map((node) => {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
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
    ['await new Promise(setImmediate);', 'waits on a timer'],
    ["import { setTimeout } from 'node:timers/promises';", 'imports a timer to wait on'],
    ["import { scheduler } from 'timers/promises';", 'imports a timer to wait on'],
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
