import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const userId = crypto.randomUUID();
const roomId = crypto.randomUUID();
const silent = { info: () => undefined, warn: () => undefined };

describe('db: 0033 watch party chat, controls and search', () => {
  let database: SocketDatabase;

  const message = (kind: 'text' | 'system', body: string, pinned = false) =>
    database.engine.query(
      `insert into watch_party_messages (id, room_id, kind, body, pinned) values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), roomId, kind, body, pinned]
    );

  const control = (scope: string | null) =>
    database.engine.query(
      `insert into watch_party_personal_controls (user_id, target_key, room_id, favourite) values ($1, 'user:x', $2, true)`,
      [userId, scope]
    );

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.query(`insert into users (id, email) values ($1, 'u@example.com')`, [
      userId,
    ]);
    await database.engine.query(
      `insert into watch_party_rooms (id, owner_key, name, search_text, visibility, allow_guests, playback, permissions_version)
       values ($1, $2, 'Friday movie night', 'ana anime marathon', 'public', true, '{}', 1)`,
      [roomId, `user:${userId}`]
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { scenario: 'a 200-character line', kind: 'text' as const, body: 'a'.repeat(200), ok: true },
    { scenario: 'a 201-character line', kind: 'text' as const, body: 'a'.repeat(201), ok: false },
    { scenario: 'a long system line', kind: 'system' as const, body: 's'.repeat(400), ok: true },
  ])('stores $scenario: $ok', async ({ kind, body, ok }) => {
    const insert = message(kind, body);

    await (ok ? expect(insert).resolves.toBeDefined() : expect(insert).rejects.toThrow());
  });

  it('pins one line per room', async () => {
    await message('text', 'first', true);

    await expect(message('text', 'second', true)).rejects.toThrow();
  });

  it('keeps one everywhere control per target, beside one per room', async () => {
    await control(null);
    await control(roomId);

    await expect(control(null)).rejects.toThrow();
  });

  it('searches a room by its name and its search text', async () => {
    const { rows } = await database.engine.query<{ id: string }>(
      `select id from watch_party_rooms where search_vector @@ websearch_to_tsquery('simple', 'movie anime')`
    );

    expect(rows.map((row) => row.id)).toEqual([roomId]);
  });
});
