import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  BROWSER,
  expectedLevel,
  levelDifferences,
  SERVER,
  trackedTsconfigs,
  UNSET,
} from './ecmascript-baseline';

function project(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'ecmascript-baseline-'));
  for (const [file, config] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), JSON.stringify(config));
  }
  return root;
}

describe('architecture: ecmascript-baseline', () => {
  describe('the comparison', () => {
    const roots: string[] = [];
    const inProject = (files: Record<string, unknown>) => {
      const root = project(files);
      roots.push(root);
      return root;
    };
    afterAll(() => {
      for (const root of roots) rmSync(root, { recursive: true });
    });

    it.each([
      {
        name: 'a preset left at ES2022',
        files: {
          'preset.json': { compilerOptions: { target: 'ES2022', lib: ['ES2022'] } },
          'package/tsconfig.json': { extends: '../preset.json' },
        },
        expected: SERVER,
        differences: [
          'package/tsconfig.json: target ES2022, expected ES2025',
          'package/tsconfig.json: lib [lib.es2022.d.ts], expected [lib.es2025.d.ts]',
        ],
      },
      {
        name: 'a package overriding the lib its preset sets',
        files: {
          'preset.json': { compilerOptions: { target: 'ES2024', lib: ['ES2024', 'DOM'] } },
          'package/tsconfig.json': {
            extends: '../preset.json',
            compilerOptions: { lib: ['ES2023', 'DOM'] },
          },
        },
        expected: BROWSER,
        differences: [
          'package/tsconfig.json: lib [lib.dom.d.ts,lib.es2023.d.ts], expected [lib.dom.d.ts,lib.es2024.d.ts]',
        ],
      },
      {
        name: 'a base that sets a target',
        files: {
          'package/tsconfig.json': { compilerOptions: { target: 'ES2022' } },
        },
        expected: UNSET,
        differences: ['package/tsconfig.json: target ES2022, expected unset'],
      },
      {
        name: 'a config that agrees with its tier',
        files: {
          'preset.json': { compilerOptions: { target: 'ES2025', lib: ['ES2025'] } },
          'package/tsconfig.json': { extends: '../preset.json' },
        },
        expected: SERVER,
        differences: [],
      },
    ])('reports $name', ({ files, expected, differences }) => {
      const root = inProject(files);

      expect(levelDifferences('package/tsconfig.json', expected, root)).toEqual(differences);
    });

    it('reports an extends that does not resolve', () => {
      const root = inProject({
        'package/tsconfig.json': { extends: '../missing.json', compilerOptions: {} },
      });

      expect(levelDifferences('package/tsconfig.json', UNSET, root)).toHaveLength(1);
    });
  });

  describe('the repository', () => {
    it('places every tracked tsconfig in a tier or names it', () => {
      expect(trackedTsconfigs().filter((file) => expectedLevel(file) === undefined)).toEqual([]);
    });

    it('resolves every tracked tsconfig to its tier level', () => {
      const differences = trackedTsconfigs().flatMap((file) => {
        const expected = expectedLevel(file);
        return expected === undefined ? [] : levelDifferences(file, expected);
      });

      expect(differences).toEqual([]);
    });
  });
});
