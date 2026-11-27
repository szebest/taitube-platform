import * as fs from 'node:fs';
import * as path from 'node:path';
import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const silent = { info: () => undefined, warn: () => undefined };
const backfill =
  fs
    .readFileSync(path.join(__dirname, '../../drizzle/0039_outbox_dead_state.sql'), 'utf8')
    .split('--> statement-breakpoint')
    .find((statement) => statement.includes('UPDATE')) ?? '';

describe('db: 0039 outbox status backfill', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { name: 'a published row', publishedAt: '2026-01-01T00:00:00Z', status: 'PUBLISHED' },
    { name: 'an unpublished row', publishedAt: null, status: 'PENDING' },
  ])('marks $name $status', async ({ publishedAt, status }) => {
    const id = crypto.randomUUID();
    await database.engine.query(
      `insert into outbox (id, kind, payload, published_at, status) values ($1, 'k', '{}', $2, 'PENDING')`,
      [id, publishedAt]
    );

    await database.engine.exec(backfill);
    const { rows } = await database.engine.query<{ status: string }>(
      'select status from outbox where id = $1',
      [id]
    );

    expect(rows[0]?.status).toBe(status);
  });
});
