import ts from 'typescript';
import { packageDir } from '../../scripts/workspace-packages';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * A formatter that reads the runtime's locale, clock or environment renders one string in the
 * server container and another in the browser, and a server render's hydration reports the
 * difference as an error. The locale, the zone and the reference instant are arguments.
 */
const PURE_PACKAGES = ['@kit/intl', '@kit/i18n', '@vp/intl-formats', '@vp/shared-messages'].map(
  (name) => `${packageDir(name)}/`
);

const AMBIENT_GLOBALS = new Set(['navigator', 'process', 'window', 'document', 'localStorage']);

function isDateNow(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.getText() === 'Date.now'
  );
}

function isArgumentlessDate(node: ts.Node): boolean {
  return (
    ts.isNewExpression(node) &&
    node.expression.getText() === 'Date' &&
    (node.arguments === undefined || node.arguments.length === 0)
  );
}

const CASE_METHODS = new Set(['toLocaleUpperCase', 'toLocaleLowerCase']);

function isLocaleMethodCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const method = node.expression.name.text;
  const namesItsLocale = CASE_METHODS.has(method) && node.arguments.length > 0;
  return method.startsWith('toLocale') && !namesItsLocale;
}

function isAmbientGlobal(node: ts.Node): boolean {
  const isGlobalName = ts.isIdentifier(node) && AMBIENT_GLOBALS.has(node.text);
  if (!isGlobalName) return false;
  const parent = node.parent;
  const isPropertyName = ts.isPropertyAccessExpression(parent) && parent.name === node;
  const isDeclaredName = ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent);
  return !(isPropertyName || isDeclaredName);
}

function impurities(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      isDateNow(node) ||
      isArgumentlessDate(node) ||
      isLocaleMethodCall(node) ||
      isAmbientGlobal(node)
    ) {
      found.push(`${file}: ${node.getText()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function pureSources(): string[] {
  return productionSources().filter((file) => PURE_PACKAGES.some((root) => file.startsWith(root)));
}

describe('architecture: the formatting core reads nothing from the runtime', () => {
  it.each([
    { shape: 'a navigator read', source: 'const locale = navigator.language;' },
    { shape: 'the wall clock', source: 'const now = Date.now();' },
    { shape: 'a date built from the clock', source: 'const today = new Date();' },
    { shape: 'a locale method', source: 'const text = value.toLocaleDateString();' },
    {
      shape: 'a case change by the runtime locale',
      source: 'const up = value.toLocaleUpperCase();',
    },
    { shape: 'the environment', source: "const tz = process.env['TZ'];" },
  ])('recognises $shape', ({ source }) => {
    expect(impurities('fixture.ts', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a date built from a value', source: 'const instant = new Date(iso);' },
    { shape: 'a field that shares a name', source: 'const x = config.navigator;' },
    {
      shape: 'a case change by a locale it is given',
      source: 'const up = v.toLocaleUpperCase(locale);',
    },
    { shape: 'a context field', source: 'const c = { process: 1 };' },
  ])('leaves $shape alone', ({ source }) => {
    expect(impurities('fixture.ts', source)).toEqual([]);
  });

  it('reads the packages it is asserting about', () => {
    expect(pureSources().length).toBeGreaterThan(20);
  });

  it('finds no ambient read in the formatting and message packages', () => {
    expect(pureSources().flatMap((file) => impurities(file, read(file)))).toEqual([]);
  });
});
