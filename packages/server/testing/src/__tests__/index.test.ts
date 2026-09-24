import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createMockJob, definePackageTestConfig, withEnv } from '../index';

const ROOT = resolve(import.meta.dirname, '../../../../..');
const PROJECT_DIRS = ['apps', 'packages/universal', 'packages/server', 'packages/client'];
const STANDALONE_PROJECTS = ['tests/architecture', 'tests/in-process', 'scripts/__tests__'];

function subdirectories(parent: string): string[] {
  return readdirSync(join(ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name));
}

function projectConfigs(): string[] {
  const dirs = [...PROJECT_DIRS.flatMap(subdirectories), ...STANDALONE_PROJECTS];
  return dirs.flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((file) => /^vitest.*\.config\.ts$/.test(file))
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

  it.each(projectConfigs())('runs %s with spies and env vars restored', async (config) => {
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
