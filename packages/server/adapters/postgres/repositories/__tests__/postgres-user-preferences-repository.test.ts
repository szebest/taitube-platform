import * as schema from '@vp/db';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import { expectErr, expectOk } from '@vp/testing/result';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, seedOwners } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { postgresSubject } from '../../../__tests__/contract/postgres-subject';
import { describeUserPreferencesRepositoryContract } from '../../../__tests__/contract/user-preferences-repository.contract';
import { PostgresRepositories } from '../postgres-repositories';

describeUserPreferencesRepositoryContract(postgresSubject);

describe('PostgresUserPreferencesRepository: one transaction per save', () => {
  it('writes nothing when its preferences.updated cannot be written', async () => {
    const engine = await migratedPglite();
    onTestFinished(() => engine.close());
    const db = drizzle(engine, { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    await db.execute(
      sql`alter table user_events add constraint refuse_preferences check (type <> 'preferences.updated')`
    );

    expectErr(
      await repositories.userPreferences.save({
        userId: OWNER_ID,
        preferences: { ...DEFAULT_PREFERENCES, notifications: null },
        expectedVersion: 0,
        sections: ['appearance'],
      })
    );

    expect(expectOk(await repositories.userPreferences.find(OWNER_ID))).toBeNull();
  });
});
