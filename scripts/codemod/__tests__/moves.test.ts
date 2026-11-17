import { type Moves, resolveSpecifier, splitSpecifier } from '../moves';

const MOVES: Moves = {
  '@vp/result': '@kit/result',
  '@vp/same': '@vp/same',
  '@vp/errors': {
    '.': { Failure: '@kit/errors', ApiErrorCode: '@vp/error-codes', Keep: '@vp/errors' },
  },
  '@vp/testing': { '.': '@kit/testing', './env': '@vp/testing-fixtures' },
};

describe('scripts: moves', () => {
  it.each([
    ['@vp/result', { packageName: '@vp/result', subpath: '.' }],
    ['@vp/ui/themes/sand', { packageName: '@vp/ui', subpath: './themes/sand' }],
    ['react', null],
    ['@scope', null],
  ])('splits %s', (specifier, expected) => {
    expect(splitSpecifier(specifier)).toEqual(expected);
  });

  it.each([
    [
      'a whole move keeps the subpath',
      '@vp/result/sub',
      { kind: 'whole', specifier: '@kit/result/sub' },
    ],
    ['a package that stays', '@vp/same', { kind: 'unchanged' }],
    ['an unknown package', '@vp/other', { kind: 'unchanged' }],
    ['an unlisted subpath', '@vp/errors/deep', { kind: 'unchanged' }],
    [
      'a subpath moved whole',
      '@vp/testing/env',
      { kind: 'whole', specifier: '@vp/testing-fixtures/env' },
    ],
  ])('%s', (_label, specifier, expected) => {
    expect(resolveSpecifier(MOVES, specifier)).toEqual(expected);
  });

  it('resolves a name-level export to its destination and leaves unlisted names where they are', () => {
    const resolution = resolveSpecifier(MOVES, '@vp/errors');

    if (resolution.kind !== 'by-name') throw new Error(`expected by-name, got ${resolution.kind}`);
    expect([
      resolution.of('Failure'),
      resolution.of('ApiErrorCode'),
      resolution.of('Keep'),
      resolution.of('Unlisted'),
    ]).toEqual(['@kit/errors', '@vp/error-codes', '@vp/errors', '@vp/errors']);
    expect(resolution.every).toEqual(['@kit/errors', '@vp/error-codes', '@vp/errors']);
  });
});
