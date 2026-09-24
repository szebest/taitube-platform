import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { migrateDatabase } from '../migrate-database';

const config = inProcessAppConfig({ postgres: { migrationsUrl: 'postgres://migrator@db/vp' } });
const log = createLogger({ service: 'migrate-spec', level: 'silent', format: 'json' });
const starting = new Error('database still starting');

describe('apps/api: migrateDatabase', () => {
  it('migrates the database the configuration names for migrations', async () => {
    const runMigrations = vi.fn(async (_url: string) => {});

    await migrateDatabase(config, { runMigrations, wait: vi.fn(async () => {}), log });

    expect(runMigrations).toHaveBeenCalledWith('postgres://migrator@db/vp');
  });

  it('waits two seconds between attempts while the database is starting', async () => {
    const runMigrations = vi
      .fn(async (_url: string) => {})
      .mockRejectedValueOnce(starting)
      .mockRejectedValueOnce(starting);
    const wait = vi.fn(async () => {});

    await migrateDatabase(config, { runMigrations, wait, log });

    expect(runMigrations).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[2_000], [2_000]]);
  });

  it('gives up after ten attempts with the last failure', async () => {
    const runMigrations = vi.fn(async (_url: string) => {
      throw starting;
    });

    await expect(
      migrateDatabase(config, { runMigrations, wait: vi.fn(async () => {}), log })
    ).rejects.toBe(starting);
    expect(runMigrations).toHaveBeenCalledTimes(10);
  });
});
