import ts from 'typescript';
import { fixtureProgram, serverProgram } from './program';
import { productionSources, read } from './repo-files';

const ENV_SCHEMA = 'packages/server/env-schema/src/';
const SERVER_ROOTS = ['apps/api/src/', 'apps/worker/src/', 'packages/server/'];

function declaredKeys(source: string): string[] {
  return [...source.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1] as string);
}

function unreadKeys(keys: readonly string[], appConfigSource: string): string[] {
  const read = new Set([...appConfigSource.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]));
  return keys.filter((key) => !read.has(key));
}

function isLeaf(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (checker.isArrayType(type) || type.isIntersection()) return true;
  if (type.isUnion()) return type.types.every((member) => isLeaf(checker, member));
  return !(type.flags & ts.TypeFlags.Object) || type.getProperties().length === 0;
}

function configSymbols(checker: ts.TypeChecker, root: ts.Type): Map<ts.Symbol, string[]> {
  const symbols = new Map<ts.Symbol, string[]>();
  const walk = (type: ts.Type, prefix: string): string[] => {
    const members = type.isUnion() ? type.types : [type];
    return members.flatMap((member) =>
      member.getProperties().flatMap((property) => {
        const path = `${prefix}${property.name}`;
        const propertyType = checker.getTypeOfSymbol(property);
        const leaves = isLeaf(checker, propertyType) ? [path] : walk(propertyType, `${path}.`);
        symbols.set(property, [...new Set([...(symbols.get(property) ?? []), ...leaves])]);
        return leaves;
      })
    );
  };
  walk(root, '');
  return symbols;
}

/** A reference consumes what it names unless it only reaches further in. */
function reachesFurther(node: ts.Node): boolean {
  return (
    (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) ||
    (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.name))
  );
}

function unconsumedLeaves(
  program: ts.Program,
  isDeclaration: (file: string) => boolean,
  isConsumer: (file: string) => boolean
): string[] {
  const checker = program.getTypeChecker();
  const declarationFile = program.getSourceFiles().find((file) => isDeclaration(file.fileName));
  const appConfig = declarationFile?.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === 'AppConfig'
  );
  if (!appConfig) throw new Error('AppConfig is not declared where the assertion looks for it');

  const symbols = configSymbols(checker, checker.getTypeAtLocation(appConfig.name));
  const leaves = new Set([...symbols.values()].flat());
  const consumed = new Set<string>();

  const consume = (symbol: ts.Symbol | undefined, node: ts.Node) => {
    if (!symbol || reachesFurther(node)) return;
    for (const root of checker.getRootSymbols(symbol)) {
      for (const leaf of symbols.get(root) ?? []) consumed.add(leaf);
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) consume(checker.getSymbolAtLocation(node.name), node);
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = (node.propertyName ?? node.name).getText();
      consume(checker.getTypeAtLocation(node.parent).getProperty(name), node);
    }
    ts.forEachChild(node, visit);
  };
  for (const file of program.getSourceFiles().filter((f) => isConsumer(f.fileName))) visit(file);

  return [...leaves].filter((leaf) => !consumed.has(leaf)).sort();
}

describe('architecture: every declared key is read and every config leaf is consumed', () => {
  it('recognises a key toAppConfig never reads', () => {
    expect(unreadKeys(['PORT', 'UNREAD_KEY'], 'return { port: env.PORT };')).toEqual([
      'UNREAD_KEY',
    ]);
  });

  it('recognises a config leaf no consumer reads', () => {
    const program = fixtureProgram({
      '/fixture/app-config.ts':
        'export interface AppConfig { http: { port: number; host: string }; cdn: string; pool: { max: number } }',
      '/fixture/consumer.ts': [
        "import type { AppConfig } from './app-config';",
        'declare function open(pool: { max: number }): void;',
        'export const start = (config: AppConfig) => {',
        '  const { cdn } = config;',
        '  open(config.pool);',
        '  return [config.http.port, cdn];',
        '};',
      ].join('\n'),
    });

    expect(
      unconsumedLeaves(
        program,
        (file) => file.endsWith('app-config.ts'),
        (file) => file.endsWith('consumer.ts')
      )
    ).toEqual(['http.host']);
  });

  it('reads every AppEnv key in toAppConfig', () => {
    expect(
      unreadKeys(declaredKeys(read(`${ENV_SCHEMA}app-env.ts`)), read(`${ENV_SCHEMA}app-config.ts`))
    ).toEqual([]);
  });

  it('keeps every PlatformEnv key out of AppEnv', () => {
    const appEnv = new Set(declaredKeys(read(`${ENV_SCHEMA}app-env.ts`)));

    expect(
      declaredKeys(read(`${ENV_SCHEMA}platform-env.ts`)).filter((key) => appEnv.has(key))
    ).toEqual([]);
  });

  it('consumes every AppConfig leaf in production source outside env-schema', () => {
    const roots = productionSources().filter((file) =>
      SERVER_ROOTS.some((root) => file.startsWith(root))
    );
    const program = serverProgram(roots);

    expect(
      unconsumedLeaves(
        program,
        (file) => file.endsWith(`${ENV_SCHEMA}app-config.ts`),
        (file) =>
          !file.includes('/node_modules/') &&
          !file.includes(`/${ENV_SCHEMA}`) &&
          roots.some((root) => file.endsWith(root))
      )
    ).toEqual([]);
  });
});
