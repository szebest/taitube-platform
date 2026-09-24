import { loadEnv } from '@vp/config';
import { inProcessAppConfig, toAppConfig } from '@vp/env-schema';
import { PRODUCTION_ENV } from '@vp/testing/env';
import { seedDevelopment } from '../seed-development';

describe('apps/api: seedDevelopment', () => {
  it('refuses a production configuration and writes nothing', async () => {
    const seedDatabase = vi.fn(async () => {});

    await expect(
      seedDevelopment(toAppConfig(loadEnv(PRODUCTION_ENV)), seedDatabase)
    ).rejects.toThrow('refuses NODE_ENV=production');
    expect(seedDatabase).not.toHaveBeenCalled();
  });

  it('seeds the database a development configuration names', async () => {
    const seedDatabase = vi.fn(async () => {});

    await seedDevelopment(
      inProcessAppConfig({ postgres: { url: 'postgres://db/vp' } }),
      seedDatabase
    );

    expect(seedDatabase).toHaveBeenCalledWith('postgres://db/vp');
  });
});
