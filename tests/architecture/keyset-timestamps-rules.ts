import ts from 'typescript';
import { parseSource } from './parsed-sources';

/**
 * `now()` stamps microseconds and a keyset cursor round-trips through a JS `Date`, which keeps
 * milliseconds, so a walk ordered or compared on a raw timestamp column skips the rows that share
 * the cursor row's millisecond. Its sort key, a cursor comparison written by hand in a `sql`
 * template, and the `orderBy` beside either go through `msTimestamp`.
 */
const KEYSET_CALLS = new Set(['keysetBefore', 'keysetPast']);
const TRUNCATION = new Set(['msTimestamp']);
const SCHEMA_MODULE = '@vp/db';

interface FileScope {
  /** `schema` in `import * as schema from '@vp/db'`. */
  namespaces: Set<string>;
  /** Tables imported by name, or destructured from a namespace: `const { videos: v } = schema`. */
  tables: Set<string>;
  /**
   * What a name in the file stands for: a `const` initializer, a function's returned values, or,
   * for a parameter of a local function, every argument the file passes it.
   */
  meanings: Map<string, ts.Node[]>;
  /** `cursor`, and the names destructured from it: `const { createdAt, id } = cursor`. */
  cursorNames: Set<string>;
}

const CURSOR = 'cursor';

function returnedValues(fn: ts.FunctionLikeDeclaration): ts.Node[] {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const values: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression) values.push(node.expression);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return values;
}

function scopeOf(sourceFile: ts.SourceFile): FileScope {
  const scope: FileScope = {
    namespaces: new Set(),
    tables: new Set(),
    meanings: new Map(),
    cursorNames: new Set([CURSOR]),
  };
  const mean = (name: string, nodes: ts.Node[]) =>
    scope.meanings.set(name, [...(scope.meanings.get(name) ?? []), ...nodes]);
  const functions = new Map<string, ts.FunctionLikeDeclaration>();
  const calls: { callee: string; args: readonly ts.Expression[] }[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === SCHEMA_MODULE
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) scope.namespaces.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) scope.tables.add(element.name.text);
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const { name, initializer } = node;
      const isFunction = ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer);
      if (ts.isIdentifier(name) && isFunction) {
        functions.set(name.text, initializer);
        mean(name.text, returnedValues(initializer));
      }
      if (ts.isIdentifier(name) && !isFunction) mean(name.text, [initializer]);
      if (ts.isObjectBindingPattern(name) && ts.isIdentifier(initializer)) {
        const names = name.elements.map((element) => element.name).filter(ts.isIdentifier);
        if (scope.namespaces.has(initializer.text)) {
          for (const bound of names) scope.tables.add(bound.text);
        }
        if (initializer.text === CURSOR) {
          for (const bound of names) scope.cursorNames.add(bound.text);
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.set(node.name.text, node);
      mean(node.name.text, returnedValues(node));
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      calls.push({ callee: node.expression.text, args: node.arguments });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const { callee, args } of calls) {
    for (const [index, parameter] of functions.get(callee)?.parameters.entries() ?? []) {
      const argument = args[index];
      if (argument && ts.isIdentifier(parameter.name)) mean(parameter.name.text, [argument]);
    }
  }
  return scope;
}

function isTable(node: ts.Expression, scope: FileScope): boolean {
  if (ts.isIdentifier(node)) return scope.tables.has(node.text);
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    scope.namespaces.has(node.expression.text)
  );
}

function isCallTo(node: ts.Node, names: ReadonlySet<string>): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)
  );
}

/**
 * The nodes under `root` that `matches`, following each name to what it stands for in the file.
 * Never into a `msTimestamp(...)`, which is what makes a timestamp safe to page on, nor into an
 * `await`, whose value is rows a query returned rather than SQL being built.
 */
function reach(root: ts.Node, scope: FileScope, matches: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  const followed = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (isCallTo(node, TRUNCATION) || ts.isAwaitExpression(node)) return;
    if (matches(node)) {
      found.push(node);
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isIdentifier(node) && !followed.has(node.text)) {
      followed.add(node.text);
      for (const meaning of scope.meanings.get(node.text) ?? []) visit(meaning);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** `${column} IS NULL` reads whether a timestamp is there, never its value. */
function isNullTest(node: ts.Node): boolean {
  return (
    ts.isTemplateSpan(node.parent) && /^\s*is\s+(not\s+)?null\b/i.test(node.parent.literal.text)
  );
}

function rawTimestamps(root: ts.Node, scope: FileScope): ts.Node[] {
  return reach(
    root,
    scope,
    (node) =>
      ts.isPropertyAccessExpression(node) &&
      /At$/.test(node.name.text) &&
      isTable(node.expression, scope) &&
      !isNullTest(node)
  );
}

function isSqlTemplate(node: ts.Node): node is ts.TaggedTemplateExpression & {
  template: ts.TemplateExpression;
} {
  return (
    ts.isTaggedTemplateExpression(node) &&
    ts.isIdentifier(node.tag) &&
    node.tag.text === 'sql' &&
    ts.isTemplateExpression(node.template)
  );
}

/** The template's SQL with each interpolation as `$`, and `sql.raw(op)` as the operator it is. */
function templateText(template: ts.TemplateExpression): string {
  return [
    template.head.text,
    ...template.templateSpans.map(({ expression, literal }) => {
      const raw =
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        expression.expression.name.text === 'raw';
      return `${raw ? '<' : '$'}${literal.text}`;
    }),
  ].join('');
}

const COMPARISON = /(^|[^<>-])[<>]=?(?![<>])/;
const ROW_VALUE_COMPARISON = /\(\s*\$[^()]*\)\s*[<>]=?\s*\(/;

/**
 * A cursor comparison written by hand: a `sql` template that compares a row value, or one whose
 * interpolations reach the cursor. A cutoff from the clock or a row compared with another row is
 * neither.
 */
function isCursorComparison(node: ts.Node, scope: FileScope): boolean {
  if (!isSqlTemplate(node)) return false;
  const text = templateText(node.template).replaceAll('<>', '');
  if (!COMPARISON.test(text)) return false;
  return (
    ROW_VALUE_COMPARISON.test(text) ||
    node.template.templateSpans.some(
      ({ expression }) =>
        reach(
          expression,
          scope,
          (inner) => ts.isIdentifier(inner) && scope.cursorNames.has(inner.text)
        ).length > 0
    )
  );
}

function isKeyset(node: ts.Node, scope: FileScope): boolean {
  return isCallTo(node, KEYSET_CALLS) || isCursorComparison(node, scope);
}

export function violations(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const scope = scopeOf(sourceFile);
  const found: string[] = [];
  const report = (node: ts.Node, rule: string, columns: ts.Node[]) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const names = columns.map((column) => column.getText()).join(', ');
    found.push(`${file}:${line + 1}: ${rule}: ${names}`);
  };

  const visit = (node: ts.Node): void => {
    if (isCallTo(node, KEYSET_CALLS)) {
      const [sortKey] = node.arguments;
      const raw = sortKey ? rawTimestamps(sortKey, scope) : [];
      if (raw.length > 0) report(node, 'pages on a raw timestamp', raw);
    }
    if (isCursorComparison(node, scope)) {
      const raw = rawTimestamps(node, scope);
      if (raw.length > 0) report(node, 'compares a raw timestamp to a cursor', raw);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'orderBy' &&
      reach(node.expression.expression, scope, (inner) => isKeyset(inner, scope)).length > 0
    ) {
      const raw = node.arguments.flatMap((argument) => rawTimestamps(argument, scope));
      if (raw.length > 0) report(node, 'orders a keyset walk on a raw timestamp', raw);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
