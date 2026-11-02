import * as fs from 'node:fs';
import * as path from 'node:path';
import { runMigrations } from '../migrate';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const silent = { info: () => undefined, warn: () => undefined };
const backfill =
  fs
    .readFileSync(
      path.join(__dirname, '../../drizzle/0030_analytics_hourly_and_subscription_events.sql'),
      'utf8'
    )
    .split('--> statement-breakpoint')
    .at(-1) ?? '';

describe('db: 0030 subscription events backfill', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
  });

  afterAll(async () => {
    await database.stop();
  });

  it('records every standing subscription as a gain at the time it was made', async () => {
    const [owner, subscriber, channel] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    await database.engine.exec(`
      insert into users (id, email) values ('${owner}', 'owner@example.com'), ('${subscriber}', 'fan@example.com');
      insert into channels (id, user_id, handle, display_name) values ('${channel}', '${owner}', 'owner', 'Owner');
      insert into channel_subscriptions (id, subscriber_id, channel_id, created_at)
        values ('${crypto.randomUUID()}', '${subscriber}', '${channel}', '2026-01-02T03:04:05Z');
    `);

    await database.engine.exec(backfill);
    const { rows } = await database.engine.query<{ delta: number; occurred_at: Date }>(
      'select delta, occurred_at from subscription_events where channel_id = $1',
      [channel]
    );

    expect(rows).toEqual([{ delta: 1, occurred_at: new Date('2026-01-02T03:04:05Z') }]);
  });
});
