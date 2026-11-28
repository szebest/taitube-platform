import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { platformSources } from './platform-sources';
import { read, trackedFiles } from './repo-files';

const COPY_PROPERTIES: ReadonlySet<string> = new Set([
  'label',
  'title',
  'aria-label',
  'placeholder',
  'message',
]);

const CATALOGUE_DIRECTORY =
  /^(?:locales?|catalogues?|translations?|messages|lang|i18n-data|[a-z]{2}-[A-Z]{2})$/;
const DATA_FILE = /\.(?:json|po|pot|xlf|xliff|ftl|properties|arb|yaml|yml)$/;
const MANIFEST = /(?:^|\/)(?:package|tsconfig[\w.-]*|tsconfig\/[\w.-]+)\.json$/;

const PLAIN_UTILITIES: ReadonlySet<string> = new Set(['absolute', 'grid']);
const SEPARATED_UTILITY = /^[a-z0-9]+(?:[-:/.[\]'][a-z0-9.[\]%#()'-]*)+$/;

const isClassList = (text: string): boolean =>
  text
    .trim()
    .split(/\s+/)
    .every((word) => PLAIN_UTILITIES.has(word) || SEPARATED_UTILITY.test(word));

const hasLetters = (jsxText: string): boolean =>
  /\p{L}/u.test(jsxText.replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, ''));

const isSentence = (text: string): boolean =>
  !isClassList(text) &&
  (/\p{L}{2,}\s+\p{L}+/u.test(text) || /\p{L}[.!?\u2026]$/u.test(text.trim()));

const isBranchCopy = (node: ts.Node): boolean =>
  ts.isStringLiteralLike(node) && node.text.includes('{?}') && /\p{L}/u.test(node.text);

function textOf(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map(({ literal }) => literal.text)].join('');
  }
  return undefined;
}

function propertyName(name: ts.PropertyName | ts.JsxAttributeName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

function copyValue(node: ts.Node): string | undefined {
  if (ts.isPropertyAssignment(node)) {
    const name = propertyName(node.name);
    return name !== undefined && COPY_PROPERTIES.has(name) ? textOf(node.initializer) : undefined;
  }
  if (ts.isJsxAttribute(node) && node.initializer) {
    const name = propertyName(node.name);
    if (name === undefined || !COPY_PROPERTIES.has(name)) return undefined;
    return ts.isJsxExpression(node.initializer) && node.initializer.expression
      ? textOf(node.initializer.expression)
      : textOf(node.initializer);
  }
  return undefined;
}

function isDtCall(node: ts.Node): boolean {
  const callee = ts.isCallExpression(node)
    ? node.expression
    : ts.isTaggedTemplateExpression(node)
      ? node.tag
      : undefined;
  if (callee === undefined) return false;
  return (
    (ts.isIdentifier(callee) && callee.text === 'dt') ||
    (ts.isPropertyAccessExpression(callee) && callee.name.text === 'dt')
  );
}

function copyIn(file: string, source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const value = copyValue(node);
    if (isDtCall(node)) found.push(`${file}: a dt( call`);
    if (ts.isJsxText(node) && hasLetters(node.text)) {
      found.push(`${file}: JSX text ${node.text.trim()}`);
    }
    if (value !== undefined && isSentence(value)) found.push(`${file}: copy ${value}`);
    if (isBranchCopy(node)) found.push(`${file}: plural branch ${node.getText()}`);
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, source));
  return found;
}

function catalogueFiles(files: readonly string[]): string[] {
  return files
    .filter((file) => !/\/(?:__tests__|__mocks__)\/|\.test\.tsx?$/.test(file))
    .filter((file) => {
      const [, , , pkg, ...inside] = file.split('/');
      const directories = inside.slice(0, -1);
      const isDataFile = DATA_FILE.test(file) && !MANIFEST.test(file);
      return (
        pkg !== undefined && (isDataFile || directories.some((d) => CATALOGUE_DIRECTORY.test(d)))
      );
    });
}

describe('architecture: platform packages ship no copy', () => {
  it.each([
    { shape: 'a dt( call', source: "const m = dt('{count:number} views');" },
    { shape: 'a dt method call', source: "const m = engine.dt('Hello {name}');" },
    { shape: 'JSX text', source: 'export const a = <button>Save changes</button>;' },
    { shape: 'a single JSX word', source: 'export const a = <b>Close</b>;' },
    {
      shape: 'an aria-label attribute',
      source: 'export const a = <i aria-label="Close the dialog" />;',
    },
    {
      shape: 'a braced placeholder',
      source: "export const a = <input placeholder={'Search videos'} />;",
    },
    {
      shape: 'lowercase copy ending in a full stop',
      source: "export const a = <i aria-label='close the dialog.' />;",
    },
    {
      shape: 'lowercase copy ending in an ellipsis',
      source: "export const a = <input placeholder='search videos...' />;",
    },
    {
      shape: 'lowercase copy with a hyphenated word',
      source: "export const a = { label: 're-upload the file' };",
    },
    { shape: 'a label property', source: "export const a = { label: 'Sign in to continue' };" },
    { shape: 'a plural branch', source: "export const more = { other: 'and {?} more' };" },
    { shape: 'a title property', source: "export const a = { title: 'Something went wrong.' };" },
    {
      shape: 'a message template',
      source: 'export const a = { message: `No provider for ${name}` };',
    },
  ])('recognises $shape', ({ source }) => {
    expect(copyIn('fixture.tsx', source)).toHaveLength(1);
  });

  it.each([
    {
      shape: 'a dt declaration',
      source: 'export function dt(template: string): string { return template; }',
    },
    { shape: 'a token', source: "export const a = { label: 'player.close', title: 'close' };" },
    { shape: 'a constant', source: "export const a = { message: 'MISSING_PROVIDER' };" },
    { shape: 'the count token', source: "const COUNT = '{?}';" },
    {
      shape: 'a sentence under another property',
      source: "export const a = { note: 'Not shown to users' };",
    },
    { shape: 'only a placeholder', source: 'export const a = { message: `${code} ${token}` };' },
    {
      shape: 'a class list under a copy-named slot',
      source:
        "export const a = { title: 'col-start-1 m-0 text-title', label: 'px-3 py-1.5 sm:text-sm' };",
    },
    { shape: 'JSX without words', source: 'export const a = <i>{count}</i>;' },
    { shape: 'JSX holding only an entity', source: 'export const a = <i>&nbsp;</i>;' },
    {
      shape: 'a class list with plain utilities and a quoted arbitrary value',
      source:
        "export const a = { title: \"absolute grid after:content-[''] text-fg\", label: 'grid place-items-center' };",
    },
  ])('leaves $shape alone', ({ source }) => {
    expect(copyIn('fixture.tsx', source)).toEqual([]);
  });

  it.each([
    { shape: 'a locale JSON', file: 'packages/platform/universal/i18n/src/en.json', found: 1 },
    {
      shape: 'a catalogue directory',
      file: 'packages/platform/client/ui/src/locales/en.ts',
      found: 1,
    },
    {
      shape: 'a regional locale directory',
      file: 'packages/platform/client/ui/src/pl-PL/a.ts',
      found: 1,
    },
    { shape: 'a gettext file', file: 'packages/platform/client/ui/src/copy.po', found: 1 },
    { shape: 'a manifest', file: 'packages/platform/client/ui/package.json', found: 0 },
    { shape: 'a tsconfig', file: 'packages/platform/client/ui/tsconfig.build.json', found: 0 },
    {
      shape: 'a tsconfig preset',
      file: 'packages/platform/universal/tsconfig/base.json',
      found: 0,
    },
    {
      shape: 'a spec fixture catalogue',
      file: 'packages/platform/universal/i18n/src/__tests__/locales/en.ts',
      found: 0,
    },
    { shape: 'source', file: 'packages/platform/client/ui/src/button.tsx', found: 0 },
  ])('counts $found catalogue file(s) for $shape', ({ file, found }) => {
    expect(catalogueFiles([file])).toHaveLength(found);
  });

  it('finds none in platform source', () => {
    const sources = platformSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.flatMap((file) => copyIn(file, read(file)))).toEqual([]);
  });

  it('finds no catalogue file in any platform package', () => {
    expect(catalogueFiles(trackedFiles('packages/platform'))).toEqual([]);
  });
});
