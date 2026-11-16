import ts from 'typescript';

/** The Playwright specs and helpers that drive the client apps, whose pages must hydrate first. */
export const APP_BROWSER_SPECS = /^(apps\/client\/[^/]+\/e2e|tests\/playwright)\//;

/** `a.b.c` for a chain of plain names, `undefined` for anything else. */
function dottedName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const base = dottedName(expression.expression);
  return base === undefined ? undefined : `${base}.${expression.name.text}`;
}

const calleeName = (call: ts.CallExpression): string => dottedName(call.expression) ?? '';

/** A browser spec's fixed sleep: it waits on the clock, never on the page. */
export function isPageSleep(node: ts.Node): boolean {
  return ts.isCallExpression(node) && calleeName(node).endsWith('.waitForTimeout');
}

/** Playwright's own `test`, whose pages skip the hydration wait the shared fixtures add to navigation. */
export function isBarePlaywrightTest(node: ts.Node): boolean {
  if (!ts.isImportDeclaration(node)) return false;
  const specifier = node.moduleSpecifier;
  if (!(ts.isStringLiteral(specifier) && specifier.text === '@playwright/test')) return false;
  const bindings = node.importClause?.namedBindings;
  if (node.importClause?.isTypeOnly || bindings === undefined || !ts.isNamedImports(bindings)) {
    return false;
  }
  return bindings.elements.some(
    (element) =>
      !element.isTypeOnly && element.propertyName === undefined && element.name.text === 'test'
  );
}

export function unhydratedContexts(calls: readonly ts.CallExpression[]): ts.Node[] {
  if (calls.some((call) => calleeName(call) === 'hydrateEveryPage')) return [];
  return calls.filter((call) => calleeName(call) === 'browser.newContext');
}
