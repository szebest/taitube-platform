import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * The browser's languages are one step of the locale negotiation chain. A second module reading
 * them decides a locale of its own, which the server render never saw, and the hydration renders
 * other words than the server wrote.
 */
const LOCALE_SOURCE = 'packages/client/queries/src/request-locale.ts';

const LANGUAGE_FIELDS = new Set(['language', 'languages']);

function isNavigator(expression: ts.Expression): boolean {
  const text = expression.getText();
  return text === 'navigator' || text.endsWith('.navigator');
}

function readsLanguageField(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return LANGUAGE_FIELDS.has(node.name.text) && isNavigator(node.expression);
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
    return LANGUAGE_FIELDS.has(node.argumentExpression.text) && isNavigator(node.expression);
  }
  return false;
}

function destructuresLanguageField(node: ts.Node): boolean {
  return (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer !== undefined &&
    isNavigator(node.initializer) &&
    node.name.elements.some((element) =>
      LANGUAGE_FIELDS.has((element.propertyName ?? element.name).getText())
    )
  );
}

function languageReads(file: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (readsLanguageField(node) || destructuresLanguageField(node)) {
      found.push(`${file}: ${node.getText()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return found;
}

describe('architecture: the browser languages are read in one module', () => {
  it.each([
    { shape: 'the language list', source: 'const tags = navigator.languages;' },
    { shape: 'the first language', source: 'const tag = navigator.language;' },
    { shape: 'the window navigator', source: 'const tag = window.navigator.language;' },
    { shape: 'an indexed read', source: "const tags = navigator['languages'];" },
    { shape: 'a destructured read', source: 'const { languages } = navigator;' },
  ])('recognises $shape', ({ source }) => {
    expect(languageReads('fixture.ts', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'another navigator field', source: 'const online = navigator.onLine;' },
    { shape: 'a field that shares a name', source: 'const tag = settings.language;' },
  ])('leaves $shape alone', ({ source }) => {
    expect(languageReads('fixture.ts', source)).toEqual([]);
  });

  it('finds the read in the module that owns it', () => {
    expect(languageReads(LOCALE_SOURCE, read(LOCALE_SOURCE))).not.toEqual([]);
  });

  it('finds no read anywhere else', () => {
    const elsewhere = productionSources().filter((file) => file !== LOCALE_SOURCE);

    expect(elsewhere.flatMap((file) => languageReads(file, read(file)))).toEqual([]);
  });
});
