import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

/**
 * `now()` stamps microseconds and a keyset cursor round-trips through a JS `Date`, which keeps
 * milliseconds, so a walk ordered or compared on a raw timestamp column skips the rows that share
 * the cursor row's millisecond. Its sort key and the `orderBy` beside it go through `msTimestamp`.
 */
const KEYSET_CALLS = new Set(['keysetBefore', 'keysetPast']);
const TRUNCATION = new Set(['msTimestamp']);
const SCHEMA_MODULE = '@vp/db';
const POSTGRES = 'packages/server/adapters/postgres/';

interface FileScope {
  /** `schema` in `import * as schema from '@vp/db'`. */
  namespaces: Set<string>;
  /** Tables imported by name, or destructured from a namespace: `const { videos: v } = schema`. */
  tables: Set<string>;
  /** What a name in the file stands for: a `const` initializer or a function's returned values. */
  meanings: Map<string, ts.Node[]>;
}

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
  const scope: FileScope = { namespaces: new Set(), tables: new Set(), meanings: new Map() };
  const mean = (name: string, nodes: ts.Node[]) =>
    scope.meanings.set(name, [...(scope.meanings.get(name) ?? []), ...nodes]);

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
      if (ts.isIdentifier(name)) {
        mean(
          name.text,
          [
            ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
              ? returnedValues(initializer)
              : [initializer],
          ].flat()
        );
      }
      if (
        ts.isObjectBindingPattern(name) &&
        ts.isIdentifier(initializer) &&
        scope.namespaces.has(initializer.text)
      ) {
        for (const element of name.elements) {
          if (ts.isIdentifier(element.name)) scope.tables.add(element.name.text);
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) mean(node.name.text, returnedValues(node));
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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
 * The nodes under `root` that `matches`, following each name to what it stands for in the file,
 * and never into a `msTimestamp(...)`, which is what makes a timestamp safe to page on.
 */
function reach(root: ts.Node, scope: FileScope, matches: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  const followed = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (isCallTo(node, TRUNCATION)) return;
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

function rawTimestamps(root: ts.Node, scope: FileScope): ts.Node[] {
  return reach(
    root,
    scope,
    (node) =>
      ts.isPropertyAccessExpression(node) &&
      /At$/.test(node.name.text) &&
      isTable(node.expression, scope)
  );
}

function violations(file: string, source: string): string[] {
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
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'orderBy' &&
      reach(node.expression.expression, scope, (inner) => isCallTo(inner, KEYSET_CALLS)).length > 0
    ) {
      const raw = node.arguments.flatMap((argument) => rawTimestamps(argument, scope));
      if (raw.length > 0) report(node, 'orders a keyset walk on a raw timestamp', raw);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const PREAMBLE = [
  "import * as schema from '@vp/db';",
  "import { comments } from '@vp/db';",
  'const { videos: v } = schema;',
].join('\n');

function ruleNames(body: string): string[] {
  return violations('fixture.ts', `${PREAMBLE}\n${body}`).map((hit) => hit.split(': ')[1] ?? '');
}

describe('architecture: keyset walks page on millisecond timestamps', () => {
  it.each([
    { shape: 'a destructured table column', body: 'keysetBefore(v.createdAt, v.id, cursor);' },
    {
      shape: 'a namespaced table column',
      body: "keysetPast(schema.playlists.updatedAt, schema.playlists.id, cursor, 'asc');",
    },
    {
      shape: 'a table imported by name',
      body: 'keysetBefore(comments.createdAt, comments.id, cursor);',
    },
    {
      shape: 'a const that names the column',
      body: 'const key = v.createdAt;\nkeysetBefore(key, v.id, cursor);',
    },
    {
      shape: 'a local function that returns the column',
      body: "function sortKey(sort) {\n  if (sort === 'newest') return v.createdAt;\n  return v.title;\n}\nkeysetPast(sortKey(sort), v.id, cursor, order);",
    },
    {
      shape: 'a rank built over the column',
      body: 'const INPUT = { createdAt: sql`${v.createdAt}` };\nconst rank = (input) => input.createdAt;\nkeysetBefore(rank(INPUT), v.id, cursor);',
    },
  ])('fires on a sort key read from $shape', ({ body }) => {
    expect(ruleNames(body)).toEqual(['pages on a raw timestamp']);
  });

  it.each([
    {
      shape: 'in the same query',
      body: 'db.select().from(v).where(keysetBefore(msTimestamp(v.createdAt), v.id, cursor)).orderBy(desc(v.createdAt), desc(v.id));',
    },
    {
      shape: 'through a named where clause',
      body: 'const where = keysetBefore(msTimestamp(v.createdAt), v.id, cursor);\ndb.select().from(v).where(where).orderBy(desc(v.createdAt));',
    },
  ])('fires on an orderBy beside a keyset $shape', ({ body }) => {
    expect(ruleNames(body)).toEqual(['orders a keyset walk on a raw timestamp']);
  });

  it.each([
    {
      shape: 'a truncated timestamp in the scope and the order',
      body: 'db.select().from(v).where(keysetBefore(msTimestamp(v.createdAt), v.id, cursor)).orderBy(desc(msTimestamp(v.createdAt)), desc(v.id));',
    },
    {
      shape: 'a const that truncates',
      body: 'const at = msTimestamp(v.createdAt);\ndb.select().from(v).where(keysetBefore(at, v.id, cursor)).orderBy(desc(at), desc(v.id));',
    },
    { shape: 'a counter column', body: 'keysetBefore(v.viewsCount, v.id, cursor);' },
    {
      shape: 'a rank handed in as a parameter',
      body: 'const page = (rank) => keysetBefore(rank, v.id, cursor);',
    },
    {
      shape: 'a field of a value that is no table',
      body: 'keysetBefore(input.createdAt, v.id, cursor);',
    },
    {
      shape: 'an orderBy with no keyset beside it',
      body: 'db.select().from(v).orderBy(asc(v.createdAt), asc(v.id));',
    },
  ])('lets $shape through', ({ body }) => {
    expect(ruleNames(body)).toEqual([]);
  });

  it('holds every Postgres adapter source', () => {
    const files = productionSources().filter((file) => file.startsWith(POSTGRES));

    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap((file) => violations(file, read(file)))).toEqual([]);
  });
});
