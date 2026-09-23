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
