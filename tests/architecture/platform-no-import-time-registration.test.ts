import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { platformSources } from './platform-sources';
import { read } from './repo-files';

const REGISTERING = /^(?:provide|register|define)(?:[A-Z]\w*)?$/;
const ALWAYS_SHARED = /^register(?:[A-Z]\w*)?$/;

function calleeName(call: ts.CallExpression): string | undefined {
  const { expression } = call;
  if (ts.isIdentifier(expression)) return expression.text;
  return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
}

const unwrapped = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node) || ts.isVoidExpression(node)
    ? unwrapped(node.expression)
    : node;

const isFunctionLike = (node: ts.Node): node is ts.FunctionExpression | ts.ArrowFunction =>
  ts.isFunctionExpression(node) || ts.isArrowFunction(node);

/**
 * A call whose result is dropped changes something that outlives it, so it registers; one whose
 * result is bound builds a value (`const kind = defineKind(...)`, `const p = provide(token, 1)`),
 * except `register*`, which always names shared state.
 */
function importTimeCalls(file: string, source: string): string[] {
  const found = new Set<string>();

  const check = (call: ts.CallExpression, discarded: boolean): void => {
    const name = calleeName(call);
    if (name !== undefined && REGISTERING.test(name) && (discarded || ALWAYS_SHARED.test(name))) {
      found.add(`${file}: ${call.getText()}`);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && !isFunctionLike(node)) return;
    if (ts.isClassLike(node)) return;
    if (isFunctionLike(node)) {
      const parent = node.parent;
      const immediate =
        (ts.isCallExpression(parent) && parent.expression === node) ||
        (ts.isParenthesizedExpression(parent) &&
          ts.isCallExpression(parent.parent) &&
          unwrapped(parent.parent.expression) === node);
      if (!immediate) return;
    }
    if (ts.isExpressionStatement(node)) {
      const expression = unwrapped(node.expression);
      if (ts.isCallExpression(expression)) check(expression, true);
    } else if (ts.isCallExpression(node)) {
      check(node, false);
    }
    ts.forEachChild(node, visit);
  };

  visit(parseSource(file, source));
  return [...found];
}

describe('architecture: platform modules register nothing when imported', () => {
  it.each([
    { shape: 'a dropped provide', source: "provide(Locale, 'en');" },
    { shape: 'a dropped define call', source: 'defineErrorCodes({ A: 1 });' },
    { shape: 'a method register', source: 'registry.register(kind);' },
    { shape: 'a bound register', source: 'const off = registerKind(kind);' },
    { shape: 'an awaited define', source: "await defineLocale('en');" },
    { shape: 'a call in a block', source: 'if (flag) { provideDefaults(); }' },
    { shape: 'an immediately invoked function', source: '(() => { register(a); })();' },
    { shape: 'a registration in a default export', source: 'export default registerKind(kind);' },
  ])('recognises $shape at the top level', ({ source }) => {
    expect(importTimeCalls('fixture.ts', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a function body', source: 'export function setup() { provide(T, 1); register(a); }' },
    { shape: 'an arrow body', source: 'export const setup = () => { defineKind(x); };' },
    { shape: 'a method body', source: 'export class A { run() { register(a); } }' },
    { shape: 'a bound define', source: 'export const kind = defineKind({ name: "n" });' },
    { shape: 'a bound provide', source: 'export const p = provide(Token, 1);' },
    { shape: 'a const data table', source: "export const KINDS = ['a', 'b'] as const;" },
    {
      shape: 'a name that only starts that way',
      source: 'definitely(); registerless(); provider();',
    },
  ])('leaves $shape alone', ({ source }) => {
    expect(importTimeCalls('fixture.ts', source)).toEqual([]);
  });

  it('finds none in platform source', () => {
    const sources = platformSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.flatMap((file) => importTimeCalls(file, read(file)))).toEqual([]);
  });
});
