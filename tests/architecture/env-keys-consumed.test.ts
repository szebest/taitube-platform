import { join } from 'node:path';
import ts from 'typescript';
import { fixtureProgram, productionProgram } from './program';
import { ROOT, read } from './repo-files';

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

function propertiesOf(type: ts.Type): ts.Symbol[] {
  return (type.isUnion() ? type.types : [type]).flatMap((member) => member.getProperties());
}

/** The dotted path each `AppConfig` property symbol stands at, groups as well as leaves. */
function configPaths(checker: ts.TypeChecker, root: ts.Type): Map<ts.Symbol, string> {
  const paths = new Map<ts.Symbol, string>();
  const walk = (type: ts.Type, prefix: string): void => {
    for (const property of propertiesOf(type)) {
      const path = `${prefix}${property.name}`;
      paths.set(property, path);
      const propertyType = checker.getTypeOfSymbol(property);
      if (!isLeaf(checker, propertyType)) walk(propertyType, `${path}.`);
    }
  };
  walk(root, '');
  return paths;
}

/** A receiver typed as a union takes a property any of its members declares. */
function receivingProperty(
  checker: ts.TypeChecker,
  receiving: ts.Type,
  name: string
): ts.Symbol | undefined {
  const members = checker.getNonNullableType(receiving);
  return (members.isUnion() ? members.types : [members])
    .map((member) => checker.getPropertyOfType(checker.getApparentType(member), name))
    .find((property) => property !== undefined);
}

/**
 * The leaves under `path` a receiver actually takes. A spread or an argument hands over only what
 * the receiving type declares; a receiver typed `any`, or none at all, takes everything.
 */
function leavesTaken(
  checker: ts.TypeChecker,
  path: string,
  type: ts.Type,
  receiving: ts.Type | undefined
): string[] {
  if (isLeaf(checker, type)) return [path];
  const open = !receiving || (receiving.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;
  return propertiesOf(type).flatMap((property) => {
    const taken = open ? undefined : receivingProperty(checker, receiving, property.name);
    if (!open && !taken) return [];
    return leavesTaken(
      checker,
      `${path}.${property.name}`,
      checker.getTypeOfSymbol(property),
      taken && checker.getTypeOfSymbol(taken)
    );
  });
}

function receivingType(checker: ts.TypeChecker, node: ts.Node): ts.Type | undefined {
  const { parent } = node;
  if (ts.isSpreadAssignment(parent) && ts.isObjectLiteralExpression(parent.parent)) {
    return checker.getContextualType(parent.parent);
  }
  const handedOver =
    ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.arguments?.some((argument) => argument === node)) ||
    (ts.isPropertyAssignment(parent) && parent.initializer === node);
  return handedOver && ts.isExpression(node) ? checker.getContextualType(node) : undefined;
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

  const root = checker.getTypeAtLocation(appConfig.name);
  const paths = configPaths(checker, root);
  const configNames = new Set([...paths.keys()].map((symbol) => symbol.name));
  const leaves = new Set(leavesTaken(checker, '', root, undefined).map((leaf) => leaf.slice(1)));
  const consumed = new Set<string>();

  const consume = (symbol: ts.Symbol | undefined, node: ts.Node) => {
    if (!symbol || reachesFurther(node)) return;
    for (const rootSymbol of checker.getRootSymbols(symbol)) {
      const path = paths.get(rootSymbol);
      if (path === undefined) continue;
      const type = checker.getTypeOfSymbol(rootSymbol);
      for (const leaf of leavesTaken(checker, path, type, receivingType(checker, node))) {
        consumed.add(leaf);
      }
    }
  };
  const visit = (node: ts.Node): void => {
    // Only a name AppConfig declares can reach a leaf; asking the checker about the rest is waste.
    if (ts.isPropertyAccessExpression(node) && configNames.has(node.name.text)) {
      consume(checker.getSymbolAtLocation(node.name), node);
    }
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = (node.propertyName ?? node.name).getText();
      if (configNames.has(name))
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
        'export interface AppConfig { http: { port: number; host: string }; cdn: string; pool: { max: number; bogusTtlSeconds: number } }',
      '/fixture/consumer.ts': [
        "import type { AppConfig } from './app-config';",
        'declare function open(pool: { max: number }): void;',
        'declare function listen(options: { port: number }): void;',
        'export const start = (config: AppConfig) => {',
        '  const { cdn } = config;',
        '  open(config.pool);',
        '  listen({ ...config.http });',
        '  return cdn;',
        '};',
      ].join('\n'),
    });

    expect(
      unconsumedLeaves(
        program,
        (file) => file.endsWith('app-config.ts'),
        (file) => file.endsWith('consumer.ts')
      )
    ).toEqual(['http.host', 'pool.bogusTtlSeconds']);
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
    const { program, roots } = productionProgram();
    const onServer = (file: string) =>
      SERVER_ROOTS.some((root) => file.startsWith(join(ROOT, root)));

    expect(
      unconsumedLeaves(
        program,
        (file) => file.endsWith(`${ENV_SCHEMA}app-config.ts`),
        (file) => roots.has(file) && onServer(file) && !file.includes(`/${ENV_SCHEMA}`)
      )
    ).toEqual([]);
  });
});
