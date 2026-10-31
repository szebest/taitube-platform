import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const editorId = crypto.randomUUID();
const videoId = crypto.randomUUID();
const silent = { info: () => undefined, warn: () => undefined };

describe('db: 0026 picks never overlap', () => {
  let database: SocketDatabase;

  const insert = (startsAt: string, endsAt: string) =>
    database.engine.query(
      `insert into picks (id, video_id, starts_at, ends_at, created_by, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [crypto.randomUUID(), videoId, startsAt, endsAt, editorId]
    );

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.query(
      `insert into users (id, email) values ('${editorId}', 'editor@example.com')`
    );
    await database.engine.query(
      `insert into videos (id, owner_id, title, status, visibility, source_key, source_size_bytes)
       values ('${videoId}', '${editorId}', 'Pick', 'READY', 'public', 'k', 1)`
    );
    await insert('2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z');
  });

  afterAll(async () => {
    await database.stop();
  });

  it('lets a window start where another one ends', async () => {
    await expect(insert('2026-03-02T00:00:00Z', '2026-03-03T00:00:00Z')).resolves.toBeDefined();
  });

  it.each([
    { name: 'the same window', startsAt: '2026-03-01T00:00:00Z', endsAt: '2026-03-02T00:00:00Z' },
    {
      name: 'a window inside another',
      startsAt: '2026-03-01T06:00:00Z',
      endsAt: '2026-03-01T07:00:00Z',
    },
    {
      name: 'a window straddling an end',
      startsAt: '2026-02-28T12:00:00Z',
      endsAt: '2026-03-01T12:00:00Z',
    },
  ])('refuses $name', async ({ startsAt, endsAt }) => {
    await expect(insert(startsAt, endsAt)).rejects.toMatchObject({ code: '23P01' });
  });
});
