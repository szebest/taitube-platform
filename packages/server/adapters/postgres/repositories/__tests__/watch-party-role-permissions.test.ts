import * as schema from '@vp/db';
import { WATCH_PARTY_PERMISSION_IDS } from '@vp/domain';
import { eq } from 'drizzle-orm';
import { roleIdOf } from '../../../__tests__/contract/watch-party-fixtures';
import { setUpWatchPartyDatabase } from '../../../__tests__/contract/watch-party-pglite';
import { permissionsByRole, replacePermissions } from '../watch-party-role-permissions';

const DJ = roleIdOf('dj');
const VIP = roleIdOf('vip');

describe('watch party role permissions', () => {
  let database: Awaited<ReturnType<typeof setUpWatchPartyDatabase>>;
  const storedFor = async (roleId: string) =>
    (
      await database.db
        .select()
        .from(schema.watchPartyRolePermissions)
        .where(eq(schema.watchPartyRolePermissions.roleId, roleId))
    )
      .map(({ permission }) => permission)
      .sort();

  beforeAll(async () => {
    database = await setUpWatchPartyDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  beforeEach(async () => {
    await database.reset();
  });

  it('reads each role’s permissions in registry order, leaving out ids the registry lacks', async () => {
    await database.db
      .insert(schema.watchPartyRolePermissions)
      .values({ roleId: VIP, permission: 'retired.permission' });

    const found = await permissionsByRole(database.db, [DJ, VIP]);

    expect(found.get(DJ)).toEqual(
      WATCH_PARTY_PERMISSION_IDS.filter((id) => (found.get(DJ) ?? []).includes(id))
    );
    expect(found.get(DJ)?.length).toBeGreaterThan(0);
    expect(found.get(VIP)).not.toContain('retired.permission');
    expect(await permissionsByRole(database.db, [])).toEqual(new Map());
  });

  it('gives every named role exactly the permissions it is handed, and no other role', async () => {
    const vipBefore = await storedFor(VIP);

    await replacePermissions(database.db, [{ id: DJ, permissions: ['chat.post', 'queue.add'] }]);

    expect(await storedFor(DJ)).toEqual(['chat.post', 'queue.add']);
    expect(await storedFor(VIP)).toEqual(vipBefore);

    await replacePermissions(database.db, [{ id: DJ, permissions: [] }]);
    expect(await storedFor(DJ)).toEqual([]);
  });
});
