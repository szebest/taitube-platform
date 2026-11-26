import * as fs from 'node:fs';
import * as path from 'node:path';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const DRIZZLE = path.join(__dirname, '../../drizzle');
const MIGRATION = '0044_multiple_channels';

function migrationsUpTo(tag: string): string[] {
  const journal: { entries: { tag: string }[] } = JSON.parse(
    fs.readFileSync(path.join(DRIZZLE, 'meta/_journal.json'), 'utf8')
  );
  const tags = journal.entries.map((entry) => entry.tag);
  return tags.slice(0, tags.indexOf(tag) + 1);
}

function statementsOf(tag: string): string {
  return fs.readFileSync(path.join(DRIZZLE, `${tag}.sql`), 'utf8');
}

const OWNER = '00000000-0000-7000-8000-0000000000a1';
const FAN = '00000000-0000-7000-8000-0000000000a2';
const LURKER = '00000000-0000-7000-8000-0000000000a3';
const CHANNEL = '00000000-0000-7000-8000-0000000000c1';
const VIDEO = '00000000-0000-7000-8000-0000000000d1';

describe(`db: ${MIGRATION} backfill`, () => {
  let database: SocketDatabase;

  async function rows(sql: string): Promise<Record<string, unknown>[]> {
    return (await database.engine.query<Record<string, unknown>>(sql)).rows;
  }

  beforeAll(async () => {
    database = await startSocketDatabase();
    const before = migrationsUpTo(MIGRATION).slice(0, -1);
    for (const tag of before) await database.engine.exec(statementsOf(tag));

    await database.engine.exec(`
      insert into users (id, email) values
        ('${OWNER}', 'owner@example.com'), ('${FAN}', 'fan@example.com'), ('${LURKER}', 'lurker@example.com');
      insert into channels (id, user_id, handle, display_name, subscriber_count)
        values ('${CHANNEL}', '${OWNER}', 'owner', 'Owner', 2);
      insert into videos (id, owner_id, source_key) values ('${VIDEO}', '${OWNER}', 'raw/${VIDEO}/source.mp4');
      insert into video_comments (id, video_id, author_id, content) values
        ('${crypto.randomUUID()}', '${VIDEO}', '${FAN}', 'first');
      insert into channel_subscriptions (id, subscriber_id, channel_id) values
        ('${crypto.randomUUID()}', '${FAN}', '${CHANNEL}'),
        ('${crypto.randomUUID()}', '${OWNER}', '${CHANNEL}');
    `);
    await database.engine.exec(statementsOf(MIGRATION));
  });

  afterAll(async () => {
    await database.stop();
  });

  it('marks every existing channel primary and gives a commenting or subscribing user without one a primary channel', async () => {
    expect(await rows('select user_id, handle, is_primary from channels order by user_id')).toEqual(
      [
        { user_id: OWNER, handle: 'owner', is_primary: true },
        { user_id: FAN, handle: 'u-0000000000a2', is_primary: true },
      ]
    );
  });

  it('files each video, comment and subscription under its user primary channel', async () => {
    const [fan] = await rows(`select id from channels where user_id = '${FAN}'`);

    expect(await rows('select channel_id from videos')).toEqual([{ channel_id: CHANNEL }]);
    expect(await rows('select author_channel_id from video_comments')).toEqual([
      { author_channel_id: fan?.id },
    ]);
    expect(
      await rows('select subscriber_channel_id, channel_id from channel_subscriptions')
    ).toEqual([{ subscriber_channel_id: fan?.id, channel_id: CHANNEL }]);
  });

  it('drops a self-subscription and the subscriber it counted', async () => {
    expect(await rows(`select subscriber_count from channels where id = '${CHANNEL}'`)).toEqual([
      { subscriber_count: 1 },
    ]);
  });

  it('refuses a second primary channel for one user', async () => {
    await expect(
      database.engine.exec(
        `insert into channels (id, user_id, handle, display_name, is_primary) values ('${crypto.randomUUID()}', '${OWNER}', 'second', 'Second', true)`
      )
    ).rejects.toThrow(/channels_user_primary_unique/);
  });
});
