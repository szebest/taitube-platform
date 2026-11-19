import { readdirSync } from 'node:fs';
import { join, matchesGlob, resolve } from 'node:path';

type ProjectTest = { maxWorkers?: number | string; sequence?: { groupOrder?: number } };

const ROOT = resolve(import.meta.dirname, '../../../../..');
const PACKAGE_PARENTS = [
  'apps/server',
  'apps/client',
  'packages/universal',
  'packages/server',
  'packages/client',
  'packages/platform/universal',
  'packages/platform/server',
  'packages/platform/client',
];
const OTHER_DIRS = ['tests', 'scripts/__tests__'];
const TEST_CONFIG = /^(vitest.*|integration)\.config\.ts$/;

function subdirectories(parent: string): string[] {
  return readdirSync(join(ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name));
}

/** Every vitest config in the repo: the projects `pnpm test` runs, e2e and both integration runs. */
function testConfigs(): string[] {
  const dirs = [
    ...PACKAGE_PARENTS.flatMap(subdirectories),
    ...OTHER_DIRS,
    ...subdirectories('tests'),
  ];
  return dirs.flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((file) => TEST_CONFIG.test(file))
      .map((file) => join(dir, file))
  );
}

describe('test configs', () => {
  it('reads the e2e and both integration configs as well as the projects', () => {
    expect(testConfigs()).toEqual(
      expect.arrayContaining([
        'tests/vitest.config.ts',
        'tests/integration/vitest.config.ts',
        'packages/server/ffmpeg/integration.config.ts',
      ])
    );
  });

  it.each(testConfigs())('runs %s with spies and env vars restored', async (config) => {
    const { default: loaded } = await import(join(ROOT, config));

    expect(loaded.test).toMatchObject({ restoreMocks: true, unstubEnvs: true });
  });

  it('runs projects with different worker caps in different groups, as the root run demands', async () => {
    const { default: root } = await import(join(ROOT, 'vitest.config.ts'));
    const globs: string[] = root.test.projects;
    const projects = testConfigs().filter((config) =>
      globs.some((glob) => matchesGlob(config, glob))
    );
    const tests: ProjectTest[] = await Promise.all(
      projects.map(async (config) => (await import(join(ROOT, config))).default.test)
    );

    const groups = Object.groupBy(tests, (test) => test.sequence?.groupOrder ?? 0);
    const caps = Object.values(groups).map((group = []) => [
      ...new Set(group.map((test) => test.maxWorkers ?? 'default')),
    ]);

    expect(projects).toContain('tests/architecture/vitest.config.ts');
    expect(caps.filter((cap) => cap.length > 1)).toEqual([]);
  });
});
