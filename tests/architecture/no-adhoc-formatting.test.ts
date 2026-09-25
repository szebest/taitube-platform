import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * User-facing formatting has one home. `toLocaleString()` with no locale renders in whatever
 * locale the runtime has, and a hand-built `Intl` object skips the cache and the allowlists.
 */
const FORMATTING_HOME = 'packages/universal/intl/';

/**
 * The browser binding reads the runtime's own time zone (`resolvedOptions()`), which is detection,
 * not formatting, and detection belongs to the one browser-coupled package.
 */
const DETECTION = 'packages/client/intl-react/src/browser-environment.ts';

/** Where a `toFixed` result can only be text a person reads; server-side it builds FFmpeg arguments. */
const BROWSER_REACHABLE = ['apps/web/', 'packages/client/', 'packages/universal/'];

function isMethodCall(node: ts.Node, matches: (name: string) => boolean): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    matches(node.expression.name.text)
  );
}

function isIntlConstruction(node: ts.Node): boolean {
  const callee =
    ts.isNewExpression(node) || ts.isCallExpression(node) ? node.expression : undefined;
  return (
    callee !== undefined &&
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === 'Intl' &&
    /^[A-Z]/.test(callee.name.text)
  );
}

function adhocFormatting(file: string, source: string, browserReachable: boolean): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const localeMethod = isMethodCall(node, (name) => name.startsWith('toLocale'));
    const fixed = browserReachable && isMethodCall(node, (name) => name === 'toFixed');
    if (localeMethod || fixed || isIntlConstruction(node)) found.push(`${file}: ${node.getText()}`);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function outsideTheHome(): string[] {
  return productionSources().filter(
    (file) => !file.startsWith(FORMATTING_HOME) && file !== DETECTION
  );
}

describe('architecture: user-facing formatting happens in @vp/intl and nowhere else', () => {
  it.each([
    { shape: 'a locale-less date', source: 'const s = new Date(x).toLocaleDateString();' },
    { shape: 'a locale-less number', source: 'const s = views.toLocaleString();' },
    { shape: 'a hand-built formatter', source: "const f = new Intl.NumberFormat('en');" },
    { shape: 'a formatter called without new', source: 'const zone = Intl.DateTimeFormat();' },
    { shape: 'toFixed as display', source: 'const label = `${size.toFixed(1)} MB`;' },
  ])('recognises $shape', ({ source }) => {
    expect(adhocFormatting('fixture.tsx', source, true)).toHaveLength(1);
  });

  it.each([
    { shape: 'a formatter from the package', source: 'const s = intl.format(views(n));' },
    { shape: 'an Intl type', source: 'let options: Intl.NumberFormatOptions;' },
    {
      shape: 'toFixed building an FFmpeg argument',
      source: 'args.push(t.toFixed(3));',
      browserReachable: false,
    },
  ])('leaves $shape alone', ({ source, browserReachable = true }) => {
    expect(adhocFormatting('fixture.ts', source, browserReachable)).toEqual([]);
  });

  it('still reads the frontend it is asserting about', () => {
    expect(outsideTheHome()).toContain('apps/web/src/App.tsx');
  });

  it('finds no locale method, hand-built Intl object or displayed toFixed outside @vp/intl', () => {
    const offenders = outsideTheHome().flatMap((file) =>
      adhocFormatting(
        file,
        read(file),
        BROWSER_REACHABLE.some((root) => file.startsWith(root))
      )
    );

    expect(offenders).toEqual([]);
  });
});
