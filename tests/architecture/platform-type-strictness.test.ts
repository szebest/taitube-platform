import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { platformSources } from './platform-sources';
import { read } from './repo-files';

const SUPPRESSION = /@ts-(?:ignore|nocheck)\b/;

const isConstAssertion = (type: ts.TypeNode): boolean =>
  ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === 'const';

/** The four ways to tell the compiler it is wrong, none with an exception: a fix is a type, a guard or a schema. */
function strictnessBreaches(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    found.push(`${file}:${line + 1}: ${what}`);
  };

  const visit = (node: ts.Node): void => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) at(node, 'any');
    if (ts.isAsExpression(node) && !isConstAssertion(node.type)) at(node, 'type assertion');
    if (ts.isTypeAssertionExpression(node)) at(node, 'type assertion');
    if (ts.isNonNullExpression(node)) at(node, 'non-null assertion');
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const [index, text] of source.split('\n').entries()) {
    if (SUPPRESSION.test(text)) found.push(`${file}:${index + 1}: compiler suppression`);
  }
  return found;
}

describe('architecture: platform packages are type strict', () => {
  it.each([
    { shape: 'an any annotation', source: 'export const a: any = 1;' },
    { shape: 'an any in a generic', source: 'export type A = Array<any>;' },
    { shape: 'an as assertion', source: 'export const a = x as string;' },
    { shape: 'a double assertion', source: 'export const a = x as unknown as string;', found: 2 },
    { shape: 'an angle-bracket assertion', source: 'export const a = <string>x;' },
    { shape: 'a non-null assertion', source: 'export const a = map.get(k)!;' },
    { shape: 'a non-null member access', source: 'export const a = map.get(k)!.size;' },
    { shape: 'an ignore directive', source: '// @ts-ignore\nexport const a = 1;' },
    { shape: 'a nocheck directive', source: '/* @ts-nocheck */\nexport const a = 1;' },
  ])('recognises $shape', ({ source, found = 1 }) => {
    expect(strictnessBreaches('fixture.ts', source)).toHaveLength(found);
  });

  it.each([
    { shape: 'as const', source: "export const a = ['x'] as const;" },
    {
      shape: 'a satisfies check',
      source: 'export const a = { b: 1 } satisfies Record<string, number>;',
    },
    {
      shape: 'a type predicate',
      source: 'export const f = (x: unknown): x is string => typeof x === "string";',
    },
    { shape: 'unknown', source: 'export const a: unknown = 1;' },
    { shape: 'the word any in a string', source: "export const a = 'any value';" },
    {
      shape: 'a mapped type renaming keys',
      source: 'export type A<T> = { [K in keyof T as `x${string & K}`]: T[K] };',
    },
    {
      shape: 'a ts-expect-error',
      source: '// @ts-expect-error: proves the misuse fails\nexport const a = 1;',
    },
  ])('leaves $shape alone', ({ source }) => {
    expect(strictnessBreaches('fixture.ts', source)).toEqual([]);
  });

  it('finds none in platform source', () => {
    const sources = platformSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.flatMap((file) => strictnessBreaches(file, read(file)))).toEqual([]);
  });
});
