import type { Moves } from '../moves';
import { isRewritableSource, rewriteSource } from '../source-rewrite';

const MOVES: Moves = {
  '@vp/result': '@kit/result',
  '@vp/errors': {
    '.': { Failure: '@kit/errors', classify: '@kit/errors', ApiErrorCode: '@vp/error-codes' },
  },
  '@vp/testing': { '.': { withEnv: '@kit/testing', SEEDED: '@vp/testing-fixtures' } },
  '@vp/one': { '.': { A: '@kit/one' } },
};

const rewrite = (text: string, fileName = 'a.ts') => rewriteSource(fileName, text, MOVES);

describe('scripts: rewriteSource', () => {
  it.each([
    ['import', `import { ok } from '@vp/result';`, `import { ok } from '@kit/result';`],
    [
      'import type',
      `import type { Result } from "@vp/result";`,
      `import type { Result } from "@kit/result";`,
    ],
    ['a subpath', `import x from '@vp/result/deep';`, `import x from '@kit/result/deep';`],
    ['export from', `export { ok } from '@vp/result';`, `export { ok } from '@kit/result';`],
    ['export star', `export * from '@vp/result';`, `export * from '@kit/result';`],
    ['a side-effect import', `import '@vp/result';`, `import '@kit/result';`],
    ['a namespace import', `import * as r from '@vp/result';`, `import * as r from '@kit/result';`],
    [
      'dynamic import',
      `const m = await import('@vp/result');`,
      `const m = await import('@kit/result');`,
    ],
    [
      'vi.mock(import())',
      `vi.mock(import('@vp/result'), async (importOriginal) => ({ ...(await importOriginal()) }));`,
      `vi.mock(import('@kit/result'), async (importOriginal) => ({ ...(await importOriginal()) }));`,
    ],
    [
      'vi.mock with a string',
      `vi.mock('@vp/result', () => ({}));`,
      `vi.mock('@kit/result', () => ({}));`,
    ],
    [
      'an import type node',
      `type R = import('@vp/result').Result;`,
      `type R = import('@kit/result').Result;`,
    ],
    [
      'a package that does not move',
      `import { a } from '@vp/other';`,
      `import { a } from '@vp/other';`,
    ],
    ['a name that all stays', `import { z } from '@vp/errors';`, `import { z } from '@vp/errors';`],
    [
      'one destination for every name',
      `import { A } from '@vp/one';`,
      `import { A } from '@kit/one';`,
    ],
  ])('rewrites %s', (_label, input, expected) => {
    const result = rewrite(input);

    expect(result.text).toBe(expected);
    expect(result.problems).toEqual([]);
  });

  it.each([
    [
      'one import per destination, type modifiers and aliases kept',
      `import { Failure, type ApiErrorCode, classify as c } from '@vp/errors';`,
      [
        `import { Failure, classify as c } from '@kit/errors';`,
        `import { type ApiErrorCode } from '@vp/error-codes';`,
      ],
    ],
    [
      'import type split',
      `import type { Failure, ApiErrorCode } from '@vp/errors'`,
      [
        `import type { Failure } from '@kit/errors'`,
        `import type { ApiErrorCode } from '@vp/error-codes'`,
      ],
    ],
    [
      'export from split',
      `export { Failure, ApiErrorCode } from "@vp/errors";`,
      [`export { Failure } from "@kit/errors";`, `export { ApiErrorCode } from "@vp/error-codes";`],
    ],
    [
      'a multi-line import',
      `import {\n  withEnv,\n  SEEDED,\n} from '@vp/testing';`,
      [`import { withEnv } from '@kit/testing';`, `import { SEEDED } from '@vp/testing-fixtures';`],
    ],
  ])('splits %s', (_label, input, expected) => {
    const result = rewrite(`${input}\nconst after = 1;\n`);

    expect(result.text).toBe(`${expected.join('\n')}\nconst after = 1;\n`);
    expect(result.problems).toEqual([]);
  });

  it('only touches the specifier line when one destination covers the whole import', () => {
    const input = `import {\n  Failure,\n  classify,\n} from '@vp/errors';\n`;

    expect(rewrite(input).text).toBe(`import {\n  Failure,\n  classify,\n} from '@kit/errors';\n`);
  });

  it.each([
    ['a namespace import', `import * as e from '@vp/errors';`],
    ['a star re-export', `export * from '@vp/errors';`],
    ['a dynamic import', `await import('@vp/errors');`],
    ['a mock', `vi.mock('@vp/errors');`],
  ])('reports %s that cannot be split instead of guessing', (_label, input) => {
    const result = rewrite(`\n${input}`);

    expect(result.text).toBe(`\n${input}`);
    expect(result.problems).toEqual([expect.stringContaining('a.ts:2:')]);
  });

  it('never adds a .js extension', () => {
    expect(
      rewrite(`import { ok } from './local';\nimport { r } from '@vp/result';`).text
    ).not.toContain('.js');
  });

  it.each([
    ['a.ts', true],
    ['a.tsx', true],
    ['a.mjs', true],
    ['a.json', false],
    ['a.md', false],
  ])('knows %s is rewritable source: %s', (file, expected) => {
    expect(isRewritableSource(file)).toBe(expected);
  });
});
