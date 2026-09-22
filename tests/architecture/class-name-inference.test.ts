import { productionSources, read } from './repo-files';

/**
 * An error's identity is `instanceof`, and its retry class is `classifyError` in `@vp/errors`.
 * Neither is a string. This started as one rule about `constructor.name`; the same defect turned up
 * three more ways - comparing `.name` to an error class, duck-typing `.isRetryable`, and comparing
 * `.code` to a bare literal instead of the `ErrorCodes` member - so it is one assertion now.
 */
const CONSTRUCTOR_NAME = [
  /constructor\s*\.\s*name\s*[!=]=+\s*['"`]/,
  /['"`]\s*[!=]=+\s*[\w$.?]*\.constructor\s*\.\s*name/,
];

/** `.name === 'UnrecoverableError'` and friends: a class identity read as a string. */
const ERROR_CLASS_NAME = /\.\s*name\s*[!=]=+\s*['"`]\w*Error['"`]/;

/** `.isRetryable === false`: the retry class read off an error's shape. */
const RETRYABILITY_SHAPE = /\.\s*isRetryable\s*[!=]=+/;

const CODE_LITERAL = /\.\s*code\s*[!=]=+\s*['"`]([A-Z][A-Z0-9_]*)['"`]/g;

/**
 * `@vp/errors` owns every one of these checks. `packages/server/adapters/s3/` compares `error.name`
 * deliberately: AWS SDK v3 generates a service-exception class per command, so `instanceof` is
 * unreliable across sub-package versions and `name` is what the SDK documents.
 */
const OWNERS = ['packages/universal/errors/', 'packages/server/adapters/s3/'];

function vocabulary(): Set<string> {
  const codes = new Set<string>();
  for (const file of ['api-error-codes.ts', 'pipeline-error-codes.ts']) {
    for (const match of read(`packages/universal/errors/src/${file}`).matchAll(
      /^\s{2}([A-Z][A-Z0-9_]+):\s*'/gm
    )) {
      codes.add(match[1] as string);
    }
  }
  return codes;
}

function infersFromClassName(source: string): boolean {
  return CONSTRUCTOR_NAME.some((pattern) => pattern.test(source)) || ERROR_CLASS_NAME.test(source);
}

function readsRetryabilityOffShape(source: string): boolean {
  return RETRYABILITY_SHAPE.test(source);
}

function comparesCodeToBareLiteral(source: string, codes: Set<string>): boolean {
  return [...source.matchAll(CODE_LITERAL)].some((match) => codes.has(match[1] as string));
}

function owned(file: string): boolean {
  return OWNERS.some((owner) => file.startsWith(owner));
}

describe('architecture: an error identity is instanceof and its class is the vocabulary', () => {
  it.each([
    { scenario: 'a direct comparison', line: "queue.constructor.name === 'InMemoryJobQueue'" },
    { scenario: 'an optional chain', line: "queue?.constructor.name !== 'InMemoryJobQueue'" },
    { scenario: 'the literal on the left', line: "'InMemoryJobQueue' === queue.constructor.name" },
    { scenario: 'an error class read as a name', line: "err.name === 'UnrecoverableError'" },
    { scenario: 'the same with a negation', line: "err.name !== 'PermanentError'" },
  ])('still recognises $scenario', ({ line }) => {
    expect(infersFromClassName(line)).toBe(true);
  });

  it.each([
    { scenario: 'naming an error after its class', line: 'this.name = this.constructor.name;' },
    { scenario: 'an instanceof check', line: "queue instanceof InMemoryJobQueue || name === 'x'" },
    { scenario: 'a rendition name', line: "metadata.ladder.find((r) => r.name === '720p')" },
    { scenario: 'an AWS service exception', line: "error.name === 'NoSuchKey'" },
  ])('leaves $scenario alone', ({ line }) => {
    expect(infersFromClassName(line)).toBe(false);
  });

  it.each([
    { scenario: 'a permanence check', line: 'errObj.isRetryable === false' },
    { scenario: 'a transience check', line: '(err as E).isRetryable === true' },
  ])('recognises $scenario as reading retryability off a shape', ({ line }) => {
    expect(readsRetryabilityOffShape(line)).toBe(true);
  });

  it('recognises a bare ErrorCode literal but leaves a Node errno alone', () => {
    const codes = vocabulary();

    expect(comparesCodeToBareLiteral("err.code === 'VERSION_CONFLICT'", codes)).toBe(true);
    expect(comparesCodeToBareLiteral("errorWithCode?.code === 'ENOSPC'", codes)).toBe(false);
    expect(comparesCodeToBareLiteral('err.code === ErrorCodes.VERSION_CONFLICT', codes)).toBe(false);
  });

  it('reads the vocabulary it checks against', () => {
    expect(vocabulary().size).toBeGreaterThan(30);
  });

  it('picks no class or retry policy out of a string in any production source', () => {
    const codes = vocabulary();
    const offenders = productionSources()
      .filter((file) => !owned(file))
      .filter((file) => {
        const source = read(file);
        return (
          infersFromClassName(source) ||
          readsRetryabilityOffShape(source) ||
          comparesCodeToBareLiteral(source, codes)
        );
      });

    expect(offenders).toEqual([]);
  });
});
