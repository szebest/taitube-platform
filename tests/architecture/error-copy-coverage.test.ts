import { read } from './repo-files';

/**
 * `ERROR_COPY` is `Readonly<Record<ErrorCode, ...>>`, so the compiler already refuses a code with no
 * copy. This reads the same three files as text, so the rule holds in the suite a reader runs and
 * so a key that names no catalogue entry is caught as well.
 */
const CODE_KEY = /^\s{2}([A-Z][A-Z0-9_]+):\s*'/gm;
const COPY_ENTRY = /\[ErrorCodes\.([A-Z][A-Z0-9_]+)\]:\s*'errors\.(\w+)'/g;
const CATALOGUE_KEY = /^\s{2}(\w+):\s*dt\(/gm;

const ERROR_COPY = 'packages/universal/messages/src/error-copy.ts';
const EN_ERRORS = 'packages/universal/messages/src/en/errors.ts';

function declaredCodes(): string[] {
  return [
    'packages/universal/errors/src/api-error-codes.ts',
    'packages/universal/errors/src/pipeline-error-codes.ts',
  ].flatMap((file) => [...read(file).matchAll(CODE_KEY)].map((match) => match[1] as string));
}

function copyEntries(source: string): Map<string, string> {
  return new Map(
    [...source.matchAll(COPY_ENTRY)].map((match) => [match[1] as string, match[2] as string])
  );
}

function uncovered(codes: readonly string[], copySource: string): string[] {
  const entries = copyEntries(copySource);
  return codes.filter((code) => !entries.has(code));
}

describe('architecture: every error code has user-facing copy', () => {
  it('names the code that a planted map leaves out', () => {
    const planted = "[ErrorCodes.INTERNAL]: 'errors.internal',";

    expect(uncovered(['INTERNAL', 'VIDEO_NOT_FOUND'], planted)).toEqual(['VIDEO_NOT_FOUND']);
  });

  it('reads the vocabulary and the map it is asserting about', () => {
    expect(declaredCodes().length).toBeGreaterThan(30);
    expect(copyEntries(read(ERROR_COPY)).size).toBeGreaterThan(30);
  });

  it('gives every declared code an entry in ERROR_COPY', () => {
    expect(uncovered(declaredCodes(), read(ERROR_COPY))).toEqual([]);
  });

  it('points every entry at a message the en catalogue holds', () => {
    const catalogued = new Set(
      [...read(EN_ERRORS).matchAll(CATALOGUE_KEY)].map((match) => match[1])
    );
    const dangling = [...copyEntries(read(ERROR_COPY)).values()].filter(
      (key) => !catalogued.has(key)
    );

    expect(dangling).toEqual([]);
  });
});
