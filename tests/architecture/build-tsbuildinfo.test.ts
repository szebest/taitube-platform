import ts from 'typescript';
import { read, trackedFiles } from './repo-files';

const BUILD_CONFIG = '@vp/tsconfig/build.json';

function extendsBuildConfig(file: string, source: string): boolean {
  const { config } = ts.parseConfigFileTextToJson(file, source);
  const parents: unknown = config?.extends;
  return Array.isArray(parents) ? parents.includes(BUILD_CONFIG) : parents === BUILD_CONFIG;
}

describe('architecture: every tsconfig.build.json extends the shared build config', () => {
  it.each([
    {
      scenario: 'a list holding the build config',
      source: `{ "extends": ["./tsconfig.json", "${BUILD_CONFIG}"] }`,
      extended: true,
    },
    {
      scenario: 'a comment and a trailing comma',
      source: `{ // build\n "extends": ["./tsconfig.json", "${BUILD_CONFIG}",], }`,
      extended: true,
    },
    {
      scenario: 'a byte order mark',
      source: `﻿{ "extends": ["./tsconfig.json", "${BUILD_CONFIG}"] }`,
      extended: true,
    },
    {
      scenario: 'only the package tsconfig',
      source: '{ "extends": "./tsconfig.json" }',
      extended: false,
    },
    {
      scenario: 'a list without it',
      source: '{ "extends": ["./tsconfig.json"] }',
      extended: false,
    },
    { scenario: 'no extends', source: '{ "include": ["src"] }', extended: false },
  ])('reads $scenario', ({ source, extended }) => {
    expect(extendsBuildConfig('tsconfig.build.json', source)).toBe(extended);
  });

  it('holds for every tsconfig.build.json in the workspace', () => {
    const missing = trackedFiles('apps', 'packages')
      .filter((file) => file.endsWith('/tsconfig.build.json'))
      .filter((file) => !extendsBuildConfig(file, read(file)));

    expect(missing).toEqual([]);
  });
});
