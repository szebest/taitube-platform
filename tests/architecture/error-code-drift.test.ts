import { read } from './repo-files';

/**
 * `PROBLEM_STATUS` and `RETRY_CLASS` are `Readonly<Record<ErrorCode, ...>>`, so the compiler
 * already refuses an omission. What it cannot see is the prose: SDD §6.2 is the document a reader
 * reaches for, and it is the copy that drifts. `tests/` is not a workspace package, so every
 * assertion here reads the sources as text, exactly like the rest of this suite.
 */
/** The enumeration paragraph only: the prose after it names the two maps, not more codes. */
const SDD_ENUMERATION = /### 6\.2 Error codes[^\n]*\n+([^\n]+)/;
const CODE_KEY = /^\s{2}([A-Z][A-Z0-9_]+):\s*'/gm;
const MAP_KEY = /\[ErrorCodes\.([A-Z][A-Z0-9_]+)\]/g;
const BACKTICKED = /`([A-Z][A-Z0-9_]+)`/g;

function keysOf(file: string, pattern: RegExp): string[] {
  return [...read(file).matchAll(pattern)].map((match) => match[1] as string);
}

function declaredCodes(): string[] {
  return [
    ...keysOf('packages/universal/errors/src/api-error-codes.ts', CODE_KEY),
    ...keysOf('packages/universal/errors/src/pipeline-error-codes.ts', CODE_KEY),
  ];
}

function sddCodes(): Set<string> {
  const section = SDD_ENUMERATION.exec(read('docs/SDD.md'))?.[1] ?? '';
  return new Set([...section.matchAll(BACKTICKED)].map((match) => match[1] as string));
}

describe('architecture: no error code drifts between the vocabulary, the maps and the SDD', () => {
  it('reads the vocabulary and the section it is asserting about', () => {
    expect(declaredCodes().length).toBeGreaterThan(30);
    expect(sddCodes().size).toBeGreaterThan(30);
  });

  it.each([
    { map: 'PROBLEM_STATUS', file: 'packages/universal/api-contracts/src/problem.ts' },
    { map: 'RETRY_CLASS', file: 'packages/universal/errors/src/retry-class.ts' },
  ])('gives every code an entry in $map', ({ file }) => {
    const mapped = new Set(keysOf(file, MAP_KEY));

    expect(declaredCodes().filter((code) => !mapped.has(code))).toEqual([]);
  });

  it('lists every code in SDD 6.2', () => {
    const documented = sddCodes();

    expect(declaredCodes().filter((code) => !documented.has(code))).toEqual([]);
  });

  it('documents no code the vocabulary has dropped', () => {
    const known = new Set(declaredCodes());

    expect([...sddCodes()].filter((code) => !known.has(code))).toEqual([]);
  });
});
