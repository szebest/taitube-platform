import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const ownerId = crypto.randomUUID();
const silent = { info: () => undefined, warn: () => undefined };
const PLAYBACK = '{"itemId":null,"phase":"lobby","positionMs":0,"rate":1,"anchorAt":0}';

describe('db: 0033 watch party rooms and roles', () => {
  let database: SocketDatabase;

  const room = (capacity: number | null = null) =>
    database.engine.query(
      `insert into watch_party_rooms (id, owner_key, name, visibility, allow_guests, capacity, playback, permissions_version)
       values ($1, $2, 'Movie night', 'unlisted', true, $3, $4, 1) returning id`,
      [crypto.randomUUID(), `user:${ownerId}`, capacity, PLAYBACK]
    );

  const role = (roomId: string, key: string | null, position: number) =>
    database.engine.query(
      `insert into watch_party_roles (id, room_id, key, kind, name, position) values ($1, $2, $3, 'grant', 'Role', $4)`,
      [crypto.randomUUID(), roomId, key, position]
    );

  const roomId = async () => ((await room()).rows[0] as { id: string }).id;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.query(
      `insert into users (id, email) values ('${ownerId}', 'owner@example.com')`
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { capacity: null, ok: true },
    { capacity: 2, ok: true },
    { capacity: 1, ok: false },
  ])('takes a capacity of $capacity: $ok', async ({ capacity, ok }) => {
    const insert = room(capacity);

    await (ok ? expect(insert).resolves.toBeDefined() : expect(insert).rejects.toThrow());
  });

  it('holds one role per position and one per built-in key in a room, custom keys aside', async () => {
    const id = await roomId();
    await role(id, 'dj', 400);
    await role(id, null, 450);
    await role(id, null, 460);

    await expect(role(id, null, 400)).rejects.toThrow();
    await expect(role(id, 'dj', 401)).rejects.toThrow();
  });

  it('takes its roles, permissions and seats with a deleted room', async () => {
    const id = await roomId();
    await role(id, 'member', 1);
    await database.engine.query(
      `insert into watch_party_members (room_id, member_key, kind, joined_via, joined_at)
       values ($1, 'guest:abcdefghijklmnop', 'guest', 'link', now())`,
      [id]
    );

    await database.engine.query('delete from watch_party_rooms where id = $1', [id]);
    const left = await database.engine.query<{ count: number }>(
      `select (select count(*) from watch_party_roles where room_id = $1)
            + (select count(*) from watch_party_members where room_id = $1) as count`,
      [id]
    );

    expect(Number(left.rows[0]?.count)).toBe(0);
  });
});
