import { expectErr, expectOk } from '@vp/testing/result';
import { runMigrations } from '../migrate';
import { type SeedIdentity, upsertIdentities } from '../seed-identities';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const quiet = { info: () => {}, warn: () => {} };

const MODERATOR: SeedIdentity = {
  id: '00000000-0000-7000-8000-00000000000b',
  email: 'moderator@video-pipeline.local',
  tier: 'pro',
  role: 'MODERATOR',
};
const VIEWER: SeedIdentity = {
  id: '00000000-0000-7000-8000-000000000002',
  email: 'viewer@video-pipeline.local',
  tier: 'free',
  role: 'USER',
};

describe('db: upsertIdentities', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, quiet);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function rows(): Promise<Record<string, unknown>[]> {
    return (
      await database.engine.query<Record<string, unknown>>(
        'select id, email, tier, role from users order by id'
      )
    ).rows;
  }

  it('writes each identity with its role and tier, once however often it runs', async () => {
    expect(expectOk(await upsertIdentities(database.url, [VIEWER, MODERATOR], quiet))).toBe(2);
    expectOk(await upsertIdentities(database.url, [VIEWER, MODERATOR], quiet));

    expect(await rows()).toEqual([VIEWER, MODERATOR]);
  });

  it('updates the role and tier of an identity that already exists', async () => {
    expectOk(
      await upsertIdentities(database.url, [{ ...VIEWER, role: 'CREATOR', tier: 'pro' }], quiet)
    );

    expect(await rows()).toContainEqual({ ...VIEWER, role: 'CREATOR', tier: 'pro' });
  });

  it('reports a database it cannot reach as an error, not a throw', async () => {
    const failure = expectErr(
      await upsertIdentities('postgres://vp:vp@127.0.0.1:9/vp', [VIEWER], quiet, {
        attempts: 1,
        delayMs: 0,
      })
    );

    expect(failure.message).toContain('Failed to connect');
  });
});
