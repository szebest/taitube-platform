import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { workspacePaths } from '../tests/architecture/program';
import { productionSources, ROOT } from '../tests/architecture/repo-files';
import { load, runsInBrowser } from './workspace-packages';

const KEY_MODULE = 'packages/universal/shared-messages/src/catalogue.ts';
const FIXTURE = 'tests/architecture/message-key-usage.json';

export type KeyUsage = ReadonlyMap<string, ReadonlySet<string>>;

function stringLiterals(type: ts.Type): string[] {
  const members = type.isUnion() ? type.types : [type];
  return members.flatMap((member) => (member.isStringLiteral() ? [member.value] : []));
}

function messageKeys(checker: ts.TypeChecker, keyModule: ts.SourceFile): ReadonlySet<string> {
  const moduleSymbol = checker.getSymbolAtLocation(keyModule);
  const keySymbol = moduleSymbol && checker.tryGetMemberInModuleExports('MessageKey', moduleSymbol);
  if (!keySymbol) throw new Error(`${keyModule.fileName} exports no MessageKey`);
  return new Set(stringLiterals(checker.getDeclaredTypeOfSymbol(keySymbol)));
}

function isKeyContext(checker: ts.TypeChecker, node: ts.Expression, keys: ReadonlySet<string>) {
  const contextual = checker.getContextualType(node);
  if (!contextual) return false;
  const expected = stringLiterals(checker.getBaseConstraintOfType(contextual) ?? contextual);
  return expected.length > 0 && expected.every((value) => keys.has(value));
}

function isPassedValue(node: ts.Node): node is ts.Expression {
  const { parent } = node;
  return (
    (ts.isCallExpression(parent) && parent.arguments.some((argument) => argument === node)) ||
    (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent))
  );
}

/**
 * The keys a node names: a literal by its text, anything else by its type, unless that type is the
 * catalogue's own key union, which says only that some key flows through and would name every one.
 */
function keysNamedBy(checker: ts.TypeChecker, node: ts.Node, keyModule: ts.SourceFile): string[] {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (!(ts.isTemplateExpression(node) || isPassedValue(node))) return [];
  const type = checker.getTypeAtLocation(node);
  const alias = type.aliasSymbol?.declarations?.[0]?.getSourceFile();
  return alias === keyModule ? [] : stringLiterals(type);
}

/**
 * Every message key a source names, by the files that name it. A node counts where the type checker
 * expects a message key: `ui.${key}` over a union of names yields each key, a value read from an
 * `as const` table yields the keys its type holds, and an SSE event `'live.viewers'` with the same
 * text as a key does not count.
 */
export function messageKeyUsage(
  program: ts.Program,
  keyModule: string,
  files: readonly string[]
): KeyUsage {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(keyModule);
  if (!source) throw new Error(`${keyModule} is not in the program`);
  const keys = messageKeys(checker, source);
  const usage = new Map<string, Set<string>>([...keys].map((key) => [key, new Set<string>()]));

  const visit = (file: string) => (node: ts.Node) => {
    const named = keysNamedBy(checker, node, source);
    if (named.length > 0 && ts.isExpression(node) && isKeyContext(checker, node, keys)) {
      for (const key of named) usage.get(key)?.add(file);
    }
    ts.forEachChild(node, visit(file));
  };
  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    if (sourceFile) ts.forEachChild(sourceFile, visit(file));
  }
  return usage;
}

/** The workspace package each key's call sites live in, the shape the fixture stores. */
export function consumersByKey(
  usage: KeyUsage,
  packages: readonly { name: string; dir: string }[]
): Record<string, string[]> {
  const byDepth = [...packages].sort((a, b) => b.dir.length - a.dir.length);
  const ownerOf = (file: string) =>
    byDepth.find(({ dir }) => file.startsWith(`${dir}/`))?.name ?? file;
  return Object.fromEntries(
    [...usage]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, files]) => [key, [...new Set([...files].map(ownerOf))].sort()])
  );
}

/** Full module resolution, React and the router included: a JSX prop is a key only through them. */
function browserProgram(roots: readonly string[]): ts.Program {
  return ts.createProgram(roots, {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    paths: workspacePaths(),
  });
}

function render(): string {
  const roots = productionSources()
    .filter(runsInBrowser)
    .map((file) => join(ROOT, file));
  const usage = messageKeyUsage(browserProgram(roots), join(ROOT, KEY_MODULE), roots);
  const relativeUsage = new Map(
    [...usage].map(([key, files]) => [key, new Set([...files].map((f) => relative(ROOT, f)))])
  );
  return `${JSON.stringify(consumersByKey(relativeUsage, load()), null, 2)}\n`;
}

if (process.argv[1]?.endsWith('message-key-usage.ts')) {
  const rendered = render();
  const target = join(ROOT, FIXTURE);
  if (process.argv.includes('--check')) {
    const current = readFileSync(target, 'utf8');
    process.stdout.write(current === rendered ? `${FIXTURE} is up to date\n` : '');
    if (current !== rendered) {
      process.stderr.write(`${FIXTURE} is stale; run pnpm scan:message-keys and commit it\n`);
      process.exitCode = 1;
    }
  } else {
    writeFileSync(target, rendered);
    process.stdout.write(`wrote ${FIXTURE}\n`);
  }
}
