import { overrideProblems, tarballOf } from '../second-app';

describe('scripts: extractable second app', () => {
  it('names the tarball of a scoped package without its version', () => {
    expect(tarballOf('@kit/design-tokens')).toBe('file:tarballs/kit-design-tokens.tgz');
  });

  it('asks for an override of each package the app reaches, and the drop of each it no longer does', () => {
    const overrides = {
      '@kit/di': tarballOf('@kit/di'),
      '@kit/errors': 'file:tarballs/errors.tgz',
      '@kit/gone': tarballOf('@kit/gone'),
      vite: 'npm:other',
    };

    expect(overrideProblems(overrides, ['@kit/di', '@kit/errors', '@kit/result'])).toEqual([
      'tests/fixtures/second-app/pnpm-workspace.yaml: override @kit/errors with file:tarballs/kit-errors.tgz',
      'tests/fixtures/second-app/pnpm-workspace.yaml: override @kit/result with file:tarballs/kit-result.tgz',
      'tests/fixtures/second-app/pnpm-workspace.yaml: drop the override of @kit/gone, which the app no longer reaches',
    ]);
  });
});
