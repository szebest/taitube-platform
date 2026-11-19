import { read, trackedFiles } from './repo-files';

const APP_SCOPE = '@vp/';

interface SourceText {
  path: string;
  text: string;
}

function appMentions(files: readonly SourceText[]): string[] {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((line, index) =>
        line.includes(APP_SCOPE)
          ? [
              `${path}:${index + 1} names ${APP_SCOPE}*. A platform package never depends on, imports or mentions an app package: invert the dependency or move the generic piece into a @kit package (packages/AGENTS.md, "The platform rule").`,
            ]
          : []
      )
  );
}

describe('architecture: platform packages never name an app package', () => {
  it.each([
    {
      shape: 'a manifest dependency',
      path: 'packages/platform/universal/di/package.json',
      text: '{\n  "dependencies": {\n    "@vp/domain": "workspace:*"\n  }\n}',
      line: 3,
    },
    {
      shape: 'an import',
      path: 'packages/platform/universal/di/src/index.ts',
      text: "import { x } from '@vp/domain';",
      line: 1,
    },
    {
      shape: 'a vitest setupFiles string',
      path: 'packages/platform/client/ui/vitest.config.ts',
      text: "export default { test: {\n  setupFiles: ['@vp/web-testing/setup'],\n} };",
      line: 2,
    },
    {
      shape: 'a tsconfig path',
      path: 'packages/platform/client/ui/tsconfig.json',
      text: '{ "compilerOptions": { "paths": { "@vp/ui": ["../x"] } } }',
      line: 1,
    },
    {
      shape: 'an AGENTS.md mention',
      path: 'packages/platform/universal/di/AGENTS.md',
      text: '# di\n\nThe app wires it through @vp/composition.',
      line: 3,
    },
  ])('reports $shape with its file and line', ({ path, text, line }) => {
    const [message, ...rest] = appMentions([{ path, text }]);

    expect(rest).toEqual([]);
    expect(message).toMatch(new RegExp(`^${path.replaceAll('.', '\\.')}:${line} names @vp/\\*`));
    expect(message).toContain('The platform rule');
  });

  it.each([
    { shape: 'a platform import', text: "import { x } from '@kit/result';" },
    { shape: 'a path that merely contains vp', text: "import 'rsvp/yes';" },
    { shape: 'prose that names no package', text: 'The app supplies the error registry.' },
  ])('passes $shape', ({ text }) => {
    expect(appMentions([{ path: 'packages/platform/universal/di/x.ts', text }])).toEqual([]);
  });

  it('finds none in any tracked file under packages/platform', () => {
    const files = trackedFiles('packages/platform').map((path) => ({ path, text: read(path) }));

    expect(files.length).toBeGreaterThan(0);
    expect(appMentions(files)).toEqual([]);
  });
});
