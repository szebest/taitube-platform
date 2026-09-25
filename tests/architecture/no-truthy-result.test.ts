import { productionSources, read, trackedFiles } from './repo-files';

/**
 * A `Result` is an object, so every operation that only asks "is this thing there" or "what is in
 * this thing" succeeds on one and answers about the wrapper. The compiler cannot see it, because
 * none of these is a property access it can reject.
 *
 * Two shapes have already shipped from this conversion. `if (!channel)` on a converted read cost
 * `subscription-service.ts` its not-found guard, and `Object.entries(counts)` cost `sql-poller.ts`
 * its gauge - `videos_by_status` reported `ok` and `value` as statuses for as long as it was live.
 * So this asserts the class, not the one instance of it.
 *
 * Which ports are converted is derived, not listed, so this widens on its own as the remaining
 * repositories land.
 */
const REPOSITORY_ROOT = 'packages/server/core/repositories/';
const METHOD = /^\s*(?:abstract\s+)?(\w+)\s*(?:<[^>]*>)?\([^;]*?\):\s*(Promise<[^;]+)/gm;
const CONTAINER = `${REPOSITORY_ROOT}repositories.ts`;
const PROPERTY = /^\s{2}(\w+):\s*(\w+);/gm;

/**
 * Every misuse the compiler lets through, as a template over the bound name. `tsc` already rejects
 * a property access, an index and a relational operator on a `Result`; the ones here type-check
 * cleanly and answer about the wrapper, which is why they need an assertion of their own.
 */
const MISUSES: ReadonlyArray<{ readonly name: string; readonly pattern: (n: string) => RegExp }> = [
  { name: 'a truthiness test', pattern: (n) => new RegExp(String.raw`if \(!?${n}\)`) },
  { name: 'a truthiness guard', pattern: (n) => new RegExp(String.raw`!${n}\s*(\|\||&&)`) },
  { name: 'a nullish default', pattern: (n) => new RegExp(String.raw`${n}\s*\?\?`) },
  { name: 'an or-default', pattern: (n) => new RegExp(String.raw`${n}\s*\|\|[^|]`) },
  { name: 'a ternary condition', pattern: (n) => new RegExp(String.raw`[(=,]\s*${n}\s*\?[^?.]`) },
  {
    name: 'an Object walk',
    pattern: (n) => new RegExp(String.raw`Object\.(entries|keys|values|assign)\(${n}[,)]`),
  },
  { name: 'a boolean cast', pattern: (n) => new RegExp(String.raw`(!!|Boolean\()${n}\b`) },
  { name: 'a serialisation', pattern: (n) => new RegExp(String.raw`JSON\.stringify\(${n}[,)]`) },
  { name: 'a string interpolation', pattern: (n) => new RegExp(String.raw`\$\{${n}\}`) },
  { name: 'a spread', pattern: (n) => new RegExp(String.raw`\.\.\.${n}(?![.\w])`) },
  { name: 'an index', pattern: (n) => new RegExp(String.raw`${n}\[`) },
  { name: 'an iteration', pattern: (n) => new RegExp(String.raw`of ${n}\)`) },
  { name: 'a comparison', pattern: (n) => new RegExp(String.raw`${n}\s*(<|>|<=|>=)\s*\w`) },
];

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

/**
 * From the binding to the end of the block that holds it. Scoping matters: the same short name is
 * routinely a parameter somewhere else in the file, and a whole-file search reports that as a
 * misuse of a binding declared fifty lines below it.
 */
function scopeOf(source: string, from: number): string {
  let depth = 0;

  for (let i = from; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      if (depth === 0) return source.slice(from, i);
      depth -= 1;
    }
  }

  return source.slice(from);
}

function misuses(file: string, properties: string[]): string[] {
  const source = read(file);
  const offenders: string[] = [];

  for (const property of properties) {
    const bindings = source.matchAll(
      new RegExp(String.raw`const (\w+) = await [\w.]*\.${property}\.\w+\(`, 'g')
    );
    for (const match of bindings) {
      const name = match[1] as string;
      const scope = scopeOf(source, match.index ?? 0);
      for (const { name: misuse, pattern } of MISUSES) {
        if (pattern(name).test(scope)) {
          offenders.push(`${file}: ${misuse} on the Result '${name}'`);
        }
      }
    }
  }

  return offenders;
}

describe('architecture: nobody reads a Result as the thing it wraps', () => {
  it('derives the converted repositories rather than listing them', () => {
    expect(convertedProperties()).toEqual(expect.arrayContaining(['categories', 'channels']));
  });

  it.each([
    {
      name: 'a truthiness test',
      line: 'const v = await repo.videos.findById(id);\nif (!v) return;',
    },
    {
      name: 'the Object walk that cost sql-poller its gauge',
      line: 'const v = await repo.videos.countByStatus();\nfor (const [s, c] of Object.entries(v)) {}',
    },
    {
      name: 'a nullish default',
      line: 'const v = await repo.videos.findById(id);\nconst x = v ?? fallback;',
    },
    {
      name: 'a string interpolation',
      line: 'const v = await repo.videos.findById(id);\nlog(`${v}`);',
    },
    {
      name: 'a spread',
      line: 'const v = await repo.videos.listByOwner(o);\nconst all = [...v];',
    },
    {
      name: 'an object spread',
      line: 'const v = await repo.videos.findById(id);\nreturn { ...v, id };',
    },
  ])('recognises $name', ({ line }) => {
    const [, name] = /const (\w+) = await/.exec(line) as RegExpExecArray;
    expect(MISUSES.some(({ pattern }) => pattern(name as string).test(line))).toBe(true);
  });

  it('leaves the unwraps alone, which are how a Result is meant to be read', () => {
    const unwraps = [
      'const v = await repo.videos.findById(id);\nif (isErr(v)) return v;',
      'const v = await repo.videos.findById(id);\nreturn map(v, (row) => row?.id);',
      'const v = await repo.videos.findById(id);\nconst row = unwrapOr(v, null);',
      'const v = await repo.videos.findById(id);\nif (v.ok) return v.value;',
      'const v = await repo.videos.findById(id);\nreturn { ...v.value, id };',
    ];

    for (const source of unwraps) {
      expect(MISUSES.some(({ pattern }) => pattern('v').test(source))).toBe(false);
    }
  });

  it('scopes a binding to its own block, so a parameter sharing its name is not a misuse', () => {
    const source =
      'function view(x: C) {\n  return { ...x };\n}\nasync function f() {\n  const x = await r.videos.findById(id);\n  return isErr(x) ? x : x.value;\n}';

    expect(scopeOf(source, source.indexOf('const x = await'))).not.toContain('...x');
  });

  it('finds no misuse of a converted repository result in any production source', () => {
    const properties = convertedProperties();
    const offenders = productionSources()
      .filter((file) => file.startsWith('apps/') || file.startsWith('packages/server/'))
      .flatMap((file) => misuses(file, properties));

    expect(offenders).toEqual([]);
  });
});
