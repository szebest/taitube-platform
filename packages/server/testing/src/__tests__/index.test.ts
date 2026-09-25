import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createMockJob, definePackageTestConfig, withEnv } from '../index';

const ROOT = resolve(import.meta.dirname, '../../../../..');
const PACKAGE_PARENTS = ['apps', 'packages/universal', 'packages/server', 'packages/client'];
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

describe('@vp/testing', () => {
  it('restores spies and stubbed env vars before every test', () => {
    const { test } = definePackageTestConfig();

    expect(test).toMatchObject({ restoreMocks: true, unstubEnvs: true });
  });

  it('keeps the defaults a package does not override', () => {
    const { test } = definePackageTestConfig({ test: { testTimeout: 60_000 } });

    expect(test).toMatchObject({ testTimeout: 60_000, restoreMocks: true, globals: true });
  });

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

  it('builds a first-attempt job that reports progress', async () => {
    const job = createMockJob('probe', { videoId: 'v1' });

    expect(job).toMatchObject({ name: 'probe', data: { videoId: 'v1' }, attemptsMade: 0 });
    await expect(job.updateProgress(50)).resolves.toBeUndefined();
  });

  it('sets and unsets env vars for one call and restores them after', async () => {
    const seen = await withEnv({ VP_SPEC_SET: 'set', PATH: undefined }, () => ({
      set: process.env.VP_SPEC_SET,
      path: process.env.PATH,
    }));

    expect(seen).toEqual({ set: 'set', path: undefined });
    expect(process.env.VP_SPEC_SET).toBeUndefined();
    expect(process.env.PATH).toBeDefined();
  });
});
