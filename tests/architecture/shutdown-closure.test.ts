import { productionSources, read } from './repo-files';

const RESOURCE_ROOTS = ['packages/server/adapters/', 'apps/api/src/services/', 'apps/worker/src/'];
const COMPOSITION = /\/composition\/[\w.-]+\.ts$/;

/** A class that holds something to release: it defines close() or stop(). */
function resourceClasses(): string[] {
  return productionSources()
    .filter((file) => RESOURCE_ROOTS.some((root) => file.startsWith(root)))
    .map(read)
    .filter((source) => /^\s{2}(?:async\s+)?(?:close|stop)\(\)/m.test(source))
    .flatMap((source) => [...source.matchAll(/^export class (\w+)/gm)].map((m) => m[1] as string));
}

/** Each `.provide(...)` call, parentheses balanced, so a lifecycle on a later line still counts. */
function provisions(source: string): string[] {
  const found: string[] = [];
  for (let at = source.indexOf('.provide('); at !== -1; at = source.indexOf('.provide(', at + 1)) {
    let depth = 0;
    for (let end = at + '.provide'.length; end < source.length; end++) {
      if (source[end] === '(') depth++;
      if (source[end] === ')' && --depth === 0) {
        found.push(source.slice(at, end + 1));
        break;
      }
    }
  }
  return found;
}

function undisposed(source: string, classes: readonly string[]): string[] {
  return provisions(source)
    .filter((call) => !/\bdispose\b|closeOnDispose/.test(call))
    .flatMap((call) => classes.filter((name) => new RegExp(`\\bnew\\s+${name}\\(`).test(call)));
}

describe('architecture: everything the container builds, it also releases', () => {
  const classes = resourceClasses();

  it('knows the resources it guards', () => {
    expect(classes).toEqual(expect.arrayContaining(['RedisCacheClient', 'SseHub', 'Poller']));
  });

  it('recognises an adapter registered with no disposer', () => {
    const module = ".provide(Redis, () => new RedisCacheClient({ type: 'url', url }))";

    expect(undisposed(module, classes)).toEqual(['RedisCacheClient']);
    expect(undisposed(`${module.slice(0, -1)}, closeOnDispose)`, classes)).toEqual([]);
  });

  it('gives every resource a composition module builds a disposer', () => {
    const offenders = productionSources()
      .filter((file) => COMPOSITION.test(file))
      .flatMap((file) => undisposed(read(file), classes).map((name) => `${file}: ${name}`));

    expect(offenders).toEqual([]);
  });
});
