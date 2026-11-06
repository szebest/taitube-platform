import { relative } from 'node:path';
import ts from 'typescript';
import { clientProgram, fixtureProgram } from './program';
import { ROOT } from './repo-files';

/** Uses of a `@deprecated` API in production source, per client app and for the client packages together. */
const DEPRECATED: Readonly<Record<string, number>> = { packages: 4, studio: 18, web: 28 };

const isDeprecated = (declaration: ts.Node | undefined) =>
  declaration !== undefined && ts.getJSDocDeprecatedTag(declaration) !== undefined;

/** Every name some declaration in the program deprecates: only a use of one of them is worth asking the checker about. */
function deprecatedNames(program: ts.Program): Set<string> {
  program.getTypeChecker();
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    const name = (node as { name?: ts.Node }).name;
    if (name !== undefined && ts.isIdentifier(name) && isDeprecated(node)) names.add(name.text);
    ts.forEachChild(node, visit);
  };
  for (const source of program.getSourceFiles()) {
    if (source.text.includes('@deprecated')) visit(source);
  }
  return names;
}

const calleeName = (callee: ts.Expression) =>
  ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : undefined;

const isCallee = (identifier: ts.Identifier) => {
  const { parent } = identifier;
  const callee =
    ts.isPropertyAccessExpression(parent) && parent.name === identifier ? parent : identifier;
  return (
    (ts.isCallExpression(callee.parent) || ts.isNewExpression(callee.parent)) &&
    callee.parent.expression === callee
  );
};

interface Use {
  file: string;
  text: string;
}

/** Each call whose resolved signature, and each other reference whose symbol, is `@deprecated`. */
function deprecatedUses(program: ts.Program, roots: ReadonlySet<string>): Use[] {
  const checker = program.getTypeChecker();
  const names = deprecatedNames(program);
  const symbolOf = (identifier: ts.Identifier) => {
    const symbol = checker.getSymbolAtLocation(identifier);
    return symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  };
  return program
    .getSourceFiles()
    .filter((source) => roots.has(source.fileName))
    .flatMap((source) => {
      const uses: Use[] = [];
      const visit = (node: ts.Node) => {
        if (
          (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
          names.has(calleeName(node.expression) ?? '') &&
          isDeprecated(checker.getResolvedSignature(node)?.declaration)
        ) {
          uses.push({ file: source.fileName, text: node.expression.getText(source) });
        } else if (ts.isIdentifier(node) && names.has(node.text) && !isCallee(node)) {
          const declarations = symbolOf(node)?.declarations ?? [];
          if (declarations.length > 0 && declarations.every(isDeprecated)) {
            uses.push({ file: source.fileName, text: node.text });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return uses;
    });
}

const FIXTURE = {
  '/fixture/client.ts': `export class Client {
  /** @deprecated Use query instead. */
  ensure(key: string): string { return key; }
  query(key: string): string { return key; }
}
/** @deprecated Use Client instead. */
export interface LegacyClient { key: string }`,
};

describe('architecture: no deprecated API in the client tiers', () => {
  it.each([
    {
      use: 'a call of a deprecated method',
      source: "import { Client } from './client';\nnew Client().ensure('k');",
      found: ['new Client().ensure'],
    },
    {
      use: 'a deprecated type, at its import and its use',
      source: "import type { LegacyClient } from './client';\nlet legacy: LegacyClient;",
      found: ['LegacyClient', 'LegacyClient'],
    },
    {
      use: 'nothing in its replacement',
      source: "import { Client } from './client';\nnew Client().query('k');",
      found: [],
    },
  ])('finds $use', ({ source, found }) => {
    const program = fixtureProgram({ ...FIXTURE, '/fixture/use.ts': source });

    expect(deprecatedUses(program, new Set(['/fixture/use.ts']))).toEqual(
      found.map((text) => ({ file: '/fixture/use.ts', text }))
    );
  });

  it('holds the deprecated uses at their number per app and for the packages', () => {
    const { program, roots } = clientProgram();
    const uses = deprecatedUses(program, roots).map(({ file }) => relative(ROOT, file));
    const areaOf = (use: string) =>
      use.startsWith('packages/') ? 'packages' : (use.split('/')[2] ?? '');

    expect(roots.size).toBeGreaterThan(500);
    expect(
      Object.fromEntries(
        Object.keys(DEPRECATED).map((area) => [
          area,
          uses.filter((use) => areaOf(use) === area).length,
        ])
      )
    ).toEqual(DEPRECATED);
  });
});
