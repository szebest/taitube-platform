import { seedDatabase } from '@vp/db/seed';
import { PRODUCTION_ENV } from '@vp/testing/env';
import { seed } from '../seed';

vi.mock(import('@vp/db/seed'), async (importOriginal) => ({
  ...(await importOriginal()),
  seedDatabase: vi.fn(async () => {}),
}));

describe('apps/api: seed', () => {
  it('refuses a production database and writes nothing to it', async () => {
    await expect(seed(PRODUCTION_ENV)).rejects.toThrow('refuses NODE_ENV=production');

    expect(seedDatabase).not.toHaveBeenCalled();
  });

  it('seeds the database a development environment names', async () => {
    await seed({ NODE_ENV: 'development', DATABASE_URL: 'postgres://localhost:5432/vp' });

    expect(seedDatabase).toHaveBeenCalledWith('postgres://localhost:5432/vp');
  });
});
