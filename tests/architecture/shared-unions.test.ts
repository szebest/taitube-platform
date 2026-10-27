import ts from 'typescript';
import { clientApps } from './client-apps';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

const isStringLiteralUnion = (node: ts.Node): node is ts.UnionTypeNode =>
  ts.isUnionTypeNode(node) &&
  node.types.filter((member) => ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal))
    .length > 1;

/** A props type: a `*Props` interface or alias, or a type literal written straight onto a parameter. */
function propsTypes(sourceFile: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text.endsWith('Props')
    ) {
      found.push(node);
      return;
    }
    if (ts.isParameter(node) && node.type && ts.isTypeLiteralNode(node.type)) found.push(node.type);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Every union of string literals a member of a props type spells out. `Omit<X, 'a' | 'b'>` names keys,
 * not a member's values, so only a property's own type is read.
 */
function inlineUnions(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const inMember = (node: ts.Node): void => {
    if (isStringLiteralUnion(node)) found.push(`${file}: ${node.getText()}`);
    else ts.forEachChild(node, inMember);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isPropertySignature(node) && node.type) inMember(node.type);
    else ts.forEachChild(node, visit);
  };
  for (const props of propsTypes(sourceFile)) visit(props);
  return found;
}

/** `@vp/ui`, `@vp/components` and each app kit, `types.ts` aside: that is where a shared union is narrowed. */
function kitSources(): string[] {
  const roots = [
    'packages/client/ui/src/',
    'packages/client/components/src/',
    ...clientApps().map((app) => `${app}/src/components/`),
  ];
  return productionSources()
    .filter((file) => roots.some((root) => file.startsWith(root)))
    .filter((file) => !file.endsWith('/types.ts'));
}

describe('architecture: props types use the shared option unions', () => {
  it.each([
    { shape: 'an interface member', source: "interface ChipProps { size?: 'sm' | 'md'; }" },
    { shape: 'an alias member', source: "type BarProps = Base & { tone: 'info' | 'danger' };" },
    {
      shape: 'a union inside a member',
      source: "interface RowProps { sides: Array<'start' | 'end'>; }",
    },
    {
      shape: 'a parameter typed in place',
      source: "const Bar = (props: { variant: 'inline' | 'palette' }) => null;",
    },
    {
      shape: 'a union beside a shared one',
      source: "interface CardProps { fill?: FillOption | 'glass' | 'paper'; }",
    },
  ])('fires on $shape', ({ source }) => {
    expect(inlineUnions('fixture.tsx', source)).toHaveLength(1);
  });

  it.each([
    { shape: 'a shared union', source: 'interface ChipProps { size?: ChipSize; }' },
    {
      shape: 'keys left out of a base',
      source: "interface MenuProps extends Omit<Part<'Content'>, 'side' | 'align'> {}",
    },
    { shape: 'one literal', source: "interface LiveProps { kind: 'live'; }" },
    { shape: 'a union outside a props type', source: "type PhysicalSide = 'top' | 'left';" },
    {
      shape: 'an optional literal',
      source: "interface DotProps { tone?: 'live' | undefined; }",
    },
  ])('leaves $shape alone', ({ source }) => {
    expect(inlineUnions('fixture.tsx', source)).toEqual([]);
  });

  it('finds none in @vp/ui, @vp/components or an app kit', () => {
    expect(kitSources().flatMap((file) => inlineUnions(file, read(file)))).toEqual([]);
  });
});
