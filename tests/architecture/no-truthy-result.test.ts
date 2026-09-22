import { productionSources, read, trackedFiles } from './repo-files';

/**
 * A `Result` is an object, so it is always truthy: `if (!channel)` on a converted repository read
 * compiles, passes typecheck and silently never fires. That is the one misuse the compiler cannot
 * see - every other one is a property access it rejects - and it cost `subscription-service.ts` its
 * not-found guard during this conversion.
 *
 * Which ports are converted is derived, not listed, so this assertion widens on its own as the
 * remaining repositories land.
 */
const REPOSITORY_ROOT = 'packages/server/core/repositories/';
const METHOD = /^\s*(?:abstract\s+)?(\w+)\s*(?:<[^>]*>)?\([^;]*?\):\s*(Promise<[^;]+)/gm;
const CONTAINER = `${REPOSITORY_ROOT}repositories.ts`;
const PROPERTY = /^\s{2}(\w+):\s*(\w+);/gm;

/** Repository contract files where every I/O method already returns a `Result`. */
function convertedContracts(): Set<string> {
  const converted = new Set<string>();

  for (const file of trackedFiles(REPOSITORY_ROOT)) {
    if (!file.endsWith('.ts') || file.endsWith('index.ts') || file === CONTAINER) continue;
    const methods = [...read(file).matchAll(METHOD)];
    if (methods.length === 0) continue;
    if (methods.every(([, , returns]) => (returns as string).startsWith('Promise<Result<'))) {
      for (const match of read(file).matchAll(/export (?:interface|abstract class|type) (\w+)/g)) {
        converted.add(match[1] as string);
      }
    }
  }

  return converted;
}

/** The `Repositories` property names whose contract is converted, e.g. `categories`, `channels`. */
function convertedProperties(): string[] {
  const converted = convertedContracts();

  return [...read(CONTAINER).matchAll(PROPERTY)]
    .filter(([, , contract]) => converted.has(contract as string))
    .map(([, property]) => property as string);
}

function truthyTests(file: string, properties: string[]): string[] {
  const source = read(file);
  const offenders: string[] = [];

  for (const property of properties) {
    const bindings = source.matchAll(
      new RegExp(String.raw`const (\w+) = await [\w.]*\.${property}\.\w+\(`, 'g')
    );
    for (const [, name] of bindings) {
      const tested = new RegExp(String.raw`if \(!?${name}\)|!${name} \|\||${name} \?\?`);
      if (tested.test(source)) offenders.push(`${file}: if (!${name}) on a Result`);
    }
  }

  return offenders;
}

describe('architecture: nobody truthiness-tests a Result', () => {
  it('derives the converted repositories rather than listing them', () => {
    expect(convertedProperties()).toEqual(expect.arrayContaining(['categories', 'channels']));
  });

  it('finds no always-true guard on a converted repository read', () => {
    const properties = convertedProperties();
    const offenders = productionSources()
      .filter((file) => file.startsWith('apps/') || file.startsWith('packages/server/'))
      .flatMap((file) => truthyTests(file, properties));

    expect(offenders).toEqual([]);
  });
});
