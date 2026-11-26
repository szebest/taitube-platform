import { appReferences, escapingPaths, outside } from '../containment';

const ROOT = '/sandbox/packages/platform/server/keyspace';

describe('scripts: extractable containment', () => {
  it.each([
    {
      file: 'src/index.ts',
      text: "export * from '../../logger/src/index';",
      found: '../../logger/src/index',
    },
    {
      file: 'src/a.ts',
      text: "await import('../../../../tsconfig.base.json');",
      found: '../../../../tsconfig.base.json',
    },
    { file: 'src/a.test.ts', text: "vi.mock(import('../../x'));", found: '../../x' },
    {
      file: 'src/a.ts',
      text: '/// <reference path="../../types.d.ts" />',
      found: '../../types.d.ts',
    },
    {
      file: 'src/a.ts',
      text: "import x from '/Users/someone/repo/src/x';",
      found: '/Users/someone/repo/src/x',
    },
    {
      file: 'tsconfig.json',
      text: '{ "extends": "../../../../tsconfig.base.json" }',
      found: '../../../../tsconfig.base.json',
    },
    {
      file: 'tsconfig.json',
      text: '{ "include": ["../shared/**/*.ts"] }',
      found: '../shared/**/*.ts',
    },
    {
      file: 'tsconfig.json',
      text: '{ "references": [{ "path": "../logger" }] }',
      found: '../logger',
    },
    {
      file: 'package.json',
      text: '{ "exports": { ".": { "import": "../logger/dist/index.js" } } }',
      found: '../logger/dist/index.js',
    },
  ])('finds $found leaving the package from $file', ({ file, text, found }) => {
    expect(escapingPaths(ROOT, file, text)).toEqual([
      `${file}: ${found} leaves the package folder`,
    ]);
  });

  it.each([
    { file: 'src/index.ts', text: "import { a } from './a'; import { b } from '../src/b';" },
    { file: 'src/deep/a.ts', text: "import { ok } from '@kit/result';" },
    {
      file: 'tsconfig.json',
      text: '{ "extends": "@kit/tsconfig/server.json", "include": ["src/**/*"] }',
    },
    {
      file: 'tsconfig.json',
      text: `{ "compilerOptions": { "tsBuildInfoFile": "\${configDir}/../x" } }`,
    },
    { file: 'package.json', text: '{ "exports": { ".": "./dist/index.js" } }' },
    { file: 'README.md', text: 'see ../../logger' },
  ])('leaves a path that stays inside alone in $file', ({ file, text }) => {
    expect(escapingPaths(ROOT, file, text)).toEqual([]);
  });

  it('names each line that names an app package', () => {
    expect(appReferences('AGENTS.md', 'fine\nlike @vp/domain does\n')).toEqual([
      'AGENTS.md:2: names an app package: like @vp/domain does',
    ]);
  });

  it('keeps the paths outside the root', () => {
    expect(
      outside('/sandbox', ['/sandbox/a/b', '/sandbox-other/c', '/repo/node_modules/x'])
    ).toEqual(['/sandbox-other/c', '/repo/node_modules/x']);
  });
});
