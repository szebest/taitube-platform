import ts from 'typescript';
import { parseSource } from './parsed-sources';
import { productionSources, read, trackedFiles } from './repo-files';

/**
 * An import only says a name is reachable; `new` is the decision. The adapters package builds its
 * own parts, composition modules build the graph, and nothing else constructs a concrete adapter.
 */
const HOMES = ['packages/server/adapters/', 'packages/server/testing/'];
const COMPOSITION = /\/composition\//;
const SCOPE = /^(apps|packages)\//;

function adapterClasses(): string[] {
  return trackedFiles('packages/server/adapters')
    .filter((file) => file.endsWith('.ts') && !/__tests__|\/composition\//.test(file))
    .flatMap((file) =>
      [...read(file).matchAll(/^export class (\w+)/gm)].map((m) => m[1] as string)
    );
}

function constructs(source: string, classes: readonly string[]): string[] {
  return classes.filter((name) => new RegExp(`\\bnew\\s+${name}\\s*[(<]`).test(source));
}

function mayConstruct(file: string): boolean {
  return HOMES.some((home) => file.startsWith(home)) || COMPOSITION.test(file);
}

describe('architecture: a concrete adapter is constructed only where the graph is composed', () => {
  const classes = adapterClasses();

  it('knows the adapter classes it guards', () => {
    expect(classes).toEqual(
      expect.arrayContaining([
        'CaslAuthorizationAdapter',
        'S3StorageClient',
        'InMemoryRepositories',
      ])
    );
  });

  it('recognises an adapter constructed inside a service even when importing it is legal', () => {
    const service =
      "import { CaslAuthorizationAdapter } from '@vp/adapters/authorization';\nconst auth = new CaslAuthorizationAdapter();";

    expect(mayConstruct('apps/api/src/services/video-service.ts')).toBe(false);
    expect(constructs(service, classes)).toEqual(['CaslAuthorizationAdapter']);
  });

  it('finds no adapter constructed outside a composition module', () => {
    const offenders = productionSources()
      .filter((file) => SCOPE.test(file) && !mayConstruct(file))
      .flatMap((file) => constructs(read(file), classes).map((name) => `${file}: new ${name}`));

    expect(offenders).toEqual([]);
  });
});

/**
 * A service or a stage builds values, never collaborators. `SseConnection` is the one class here: it
 * is one per request, owns only the response it wraps, and has nothing a composition root could
 * hand in ahead of time. `Promise` and `AbortController` are per-call values like `Date`.
 */
const DOMAIN_ROOTS = ['apps/api/src/services/', 'apps/worker/src/stages/'];
const VALUES: ReadonlySet<string> = new Set([
  'Date',
  'Map',
  'Set',
  'URL',
  'Promise',
  'AbortController',
  'SseConnection',
]);

function collaboratorsBuilt(file: string, source: string): string[] {
  const sourceFile = parseSource(file, source);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node)) {
      const name = node.expression.getText();
      if (!(VALUES.has(name) || name.endsWith('Error'))) found.push(`${file}: new ${name}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

describe('architecture: a service or a stage constructs values only', () => {
  it.each([
    { built: 'a coalescer', source: 'private readonly flight = new Singleflight();' },
    { built: 'a board adapter', source: 'const adapter = new FastifyAdapter();' },
    {
      built: 'a per-job collaborator',
      source: 'const uploader = new StreamingSegmentUploader(o);',
    },
  ])('recognises $built', ({ source }) => {
    expect(collaboratorsBuilt('fixture.ts', source)).toHaveLength(1);
  });

  it.each([
    { value: 'a timestamp', source: 'const now = new Date();' },
    { value: 'a lookup', source: 'const seen = new Set<string>();' },
    { value: 'a failure', source: 'const e = new TransientError(code, message);' },
    { value: 'a per-request connection', source: 'const c = new SseConnection(res, 1, 2);' },
  ])('leaves $value alone', ({ source }) => {
    expect(collaboratorsBuilt('fixture.ts', source)).toEqual([]);
  });

  it('finds no collaborator built in a service or a stage', () => {
    const offenders = productionSources()
      .filter((file) => DOMAIN_ROOTS.some((root) => file.startsWith(root)))
      .flatMap((file) => collaboratorsBuilt(file, read(file)));

    expect(offenders).toEqual([]);
  });
});
