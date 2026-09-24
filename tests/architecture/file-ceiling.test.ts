import { read, trackedFiles } from './repo-files';

const MAX_LINES = 400;
const MAX_BYTES = 10 * 1024;

const TYPESCRIPT_FILES = [':(glob)**/*.ts', ':(glob)**/*.tsx', ':(glob)**/*.mts'];

function oversized(source: string): boolean {
  return source.split('\n').length > MAX_LINES || Buffer.byteLength(source, 'utf8') > MAX_BYTES;
}

describe('architecture: file length ceiling', () => {
  it.each([
    ['a spec over 400 lines', "it('holds', () => {});\n".repeat(MAX_LINES + 1)],
    ['a short file over 10 KB', `export const blob = '${'x'.repeat(MAX_BYTES)}';`],
  ])('fires on %s', (_name, source) => {
    expect(oversized(source)).toBe(true);
  });

  it('passes a file at the ceiling', () => {
    expect(oversized('const a = 1;\n'.repeat(MAX_LINES - 1))).toBe(false);
  });

  it('holds every tracked TypeScript file, specs and tests included, under 400 lines and 10 KB', () => {
    const files = trackedFiles(...TYPESCRIPT_FILES);
    const offenders = files.filter((file) => oversized(read(file)));

    expect(files.some((file) => file.endsWith('.test.ts'))).toBe(true);
    expect(files.some((file) => file.startsWith('tests/'))).toBe(true);
    expect(offenders).toEqual([]);
  });
});
