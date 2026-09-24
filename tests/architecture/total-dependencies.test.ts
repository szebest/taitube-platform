import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read } from './repo-files';

const ROOTS = [
  'apps/api/src/services/',
  'apps/worker/src/stages/',
  'apps/api/src/app.ts',
  'apps/worker/src/runner.ts',
  'packages/server/adapters/',
];

/** A collaborator the composition root forgot is a compile error, never a fallback built here. */
const RECOVERY = [
  /(?:\?\?|\|\|)\s*new\s+[A-Z]\w*/,
  /\?\?\s*default[A-Z]\w*/,
  /\?\?\s*inProcessAppConfig\(/,
];

/** What a default may not be: something built, something called, or a shared `default*` value. */
function inventsADependency(value: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(value)) return inventsADependency(value.expression);
  return (
    ts.isNewExpression(value) ||
    ts.isCallExpression(value) ||
    (ts.isIdentifier(value) && /^default[A-Z]/.test(value.text))
  );
}

function defaultedDependencies(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    const isDefaulted =
      (ts.isParameter(node) || ts.isBindingElement(node)) &&
      node.initializer !== undefined &&
      inventsADependency(node.initializer);
    if (isDefaulted) found.push(node.getText());
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function recoversFromAMissingDependency(file: string, source: string): boolean {
  return (
    RECOVERY.some((pattern) => pattern.test(source)) ||
    defaultedDependencies(file, source).length > 0
  );
}

describe('architecture: a service, stage, adapter or composition root never invents a dependency', () => {
  it.each([
    {
      scenario: 'a defaulted paginator',
      line: 'this.paginator = deps.paginator ?? defaultPaginator;',
    },
    {
      scenario: 'a constructed adapter',
      line: 'this.auth = deps.authorization ?? new CaslAuthorizationAdapter();',
    },
    { scenario: 'an or-constructed map', line: 'this.queues = deps.queues || new Map();' },
    {
      scenario: 'a composition root defaulting its configuration',
      line: 'const config = options.config ?? inProcessAppConfig();',
    },
    {
      scenario: 'a constructed default parameter',
      line: 'function f(flight: Singleflight = new Singleflight()) {}',
    },
    { scenario: 'a called default parameter', line: 'function f(metrics = createMetrics()) {}' },
    {
      scenario: 'a shared default parameter',
      line: 'function f(cursor: string, paginator = defaultPaginator) {}',
    },
    {
      scenario: 'a constructed destructuring default',
      line: 'const { cache = new InMemoryCache() } = deps;',
    },
    { scenario: 'a called destructuring default', line: 'const { now = clock() } = deps;' },
  ])('recognises $scenario', ({ line }) => {
    expect(recoversFromAMissingDependency('fixture.ts', line)).toBe(true);
  });

  it.each([
    { scenario: 'a defaulted tuning value', line: 'const ttl = deps.ttlSeconds ?? 3600;' },
    { scenario: 'a literal default parameter', line: 'function f(attempt = 1) {}' },
    { scenario: 'a literal destructuring default', line: 'const { patch = {} } = options;' },
  ])('leaves $scenario alone', ({ line }) => {
    expect(recoversFromAMissingDependency('fixture.ts', line)).toBe(false);
  });

  it('finds none in a service, stage, adapter or composition root', () => {
    const offenders = productionSources()
      .filter((file) => ROOTS.some((root) => file.startsWith(root)))
      .filter((file) => recoversFromAMissingDependency(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
