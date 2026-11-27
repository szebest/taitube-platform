import ts from 'typescript';
import { read, trackedFiles } from './repo-files';

/**
 * A placeholder name is lower camelCase letters, from the app's closed vocabulary: `{0}`, `{count2}`,
 * `{Name}` and `{a_b}` are positional, numbered or off-style names. The engine's types reject them,
 * and this holds the rule where an `as` could slip past the types: every `dt(` template in the
 * catalogues, and the vocabulary itself.
 */
const NAME = /^[a-z][a-zA-Z]*$/;
const TOKEN = /\{([^}:]*)(?::[^}]*)?\}/g;
const VOCABULARY = 'packages/universal/shared-messages/src/params.ts';

function templatesIn(source: string): string[] {
  const file = ts.createSourceFile('catalogue.ts', source, ts.ScriptTarget.Latest, true);
  const templates: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'dt'
    ) {
      const [first] = node.arguments;
      if (first !== undefined && ts.isStringLiteralLike(first)) templates.push(first.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return templates;
}

function badNames(templates: readonly string[]): string[] {
  return templates.flatMap((template) =>
    Array.from(template.matchAll(TOKEN), (match) => match[1] ?? '').filter(
      (name) => !NAME.test(name)
    )
  );
}

function vocabularyIn(source: string): string[] {
  return Array.from(source.matchAll(/^\s+'([^']*)',$/gm), (match) => match[1] ?? '');
}

function catalogueFiles(): string[] {
  return trackedFiles(
    'packages/universal/shared-messages/src',
    'apps/client/web/src/lib/messages',
    'apps/client/studio/src/lib/messages'
  ).filter((file) => /\/(en|pl)\/[^/]+\.ts$/.test(file));
}

describe('architecture: placeholder names are lower camelCase words', () => {
  it.each([
    { shape: 'a positional name', source: "dt('{0} views')", bad: ['0'] },
    { shape: 'a numbered name', source: "dt('{count2:number}')", bad: ['count2'] },
    { shape: 'a capitalised name', source: "dt('Hi {Name}')", bad: ['Name'] },
    { shape: 'a snake case name', source: "dt('{a_b}')", bad: ['a_b'] },
  ])('names $shape', ({ source, bad }) => {
    expect(badNames(templatesIn(source))).toEqual(bad);
  });

  it('accepts a camelCase name with a kind, and the count of a plural branch', () => {
    expect(badNames(templatesIn("dt('{perDay:number} a day')"))).toEqual([]);
  });

  it('reads the catalogues of the shared layer and both apps', () => {
    expect(catalogueFiles().length).toBeGreaterThan(70);
  });

  it('finds no off-style name in any template', () => {
    expect(badNames(catalogueFiles().flatMap((file) => templatesIn(read(file))))).toEqual([]);
  });

  it('finds no off-style name in the vocabulary', () => {
    const names = vocabularyIn(read(VOCABULARY));

    expect(names.length).toBeGreaterThan(50);
    expect(names.filter((name) => !NAME.test(name))).toEqual([]);
  });
});
