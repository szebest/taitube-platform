import * as fs from 'node:fs';
import * as path from 'node:path';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const DRIZZLE = path.join(__dirname, '../../drizzle');
const MIGRATION = '0049_community_posts';

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
const CHANNEL = '00000000-0000-7000-8000-0000000000c1';
const FAN_CHANNEL = '00000000-0000-7000-8000-0000000000c2';
const VIDEO = '00000000-0000-7000-8000-0000000000d1';
const OTHER_VIDEO = '00000000-0000-7000-8000-0000000000d2';
const ROOT = '00000000-0000-7000-8000-0000000000e1';
const REPLY = '00000000-0000-7000-8000-0000000000e2';
const ELSEWHERE = '00000000-0000-7000-8000-0000000000e3';
const POST = '00000000-0000-7000-8000-0000000000f1';
const THREAD = '00000000-0000-7000-8000-0000000000f2';

describe(`db: ${MIGRATION} comments backfill`, () => {
  let database: SocketDatabase;

  async function rows(sql: string): Promise<Record<string, unknown>[]> {
    return (await database.engine.query<Record<string, unknown>>(sql)).rows;
  }

  function commentOn(id: string, type: string, target: string): string {
    return `insert into comments (id, target_type, target_id, channel_id, author_id, author_channel_id, content)
      values ('${id}', '${type}', '${target}', '${CHANNEL}', '${FAN}', '${FAN_CHANNEL}', 'on ${type}')`;
  }

  beforeAll(async () => {
    database = await startSocketDatabase();
    const before = migrationsUpTo(MIGRATION).slice(0, -1);
    for (const tag of before) await database.engine.exec(statementsOf(tag));

    await database.engine.exec(`
      insert into users (id, email) values ('${OWNER}', 'owner@example.com'), ('${FAN}', 'fan@example.com');
      insert into channels (id, user_id, handle, display_name) values
        ('${CHANNEL}', '${OWNER}', 'owner', 'Owner'), ('${FAN_CHANNEL}', '${FAN}', 'fan', 'Fan');
      insert into videos (id, owner_id, channel_id, source_key) values
        ('${VIDEO}', '${OWNER}', '${CHANNEL}', 'raw/${VIDEO}/source.mp4'),
        ('${OTHER_VIDEO}', '${OWNER}', '${CHANNEL}', 'raw/${OTHER_VIDEO}/source.mp4');
      insert into video_comments (id, video_id, author_id, author_channel_id, content, is_pinned, hearted_at) values
        ('${ROOT}', '${VIDEO}', '${FAN}', '${FAN_CHANNEL}', 'root', true, now());
      insert into video_comments (id, video_id, author_id, author_channel_id, parent_id, content) values
        ('${REPLY}', '${VIDEO}', '${OWNER}', '${CHANNEL}', '${ROOT}', 'reply'),
        ('${ELSEWHERE}', '${OTHER_VIDEO}', '${FAN}', '${FAN_CHANNEL}', null, 'elsewhere');
      insert into comment_reports (id, comment_id, reporter_id, reason) values
        ('${crypto.randomUUID()}', '${ROOT}', '${OWNER}', 'spam');
    `);
    await database.engine.exec(statementsOf(MIGRATION));
  });

  afterAll(async () => {
    await database.stop();
  });

  it('keeps every video comment with its reply, pin, heart and report, filed under the video and its channel', async () => {
    expect(
      await rows(
        'select id, target_type, target_id, channel_id, parent_id, is_pinned, hearted_at is not null as hearted from comments order by id'
      )
    ).toEqual([
      {
        id: ROOT,
        target_type: 'video',
        target_id: VIDEO,
        channel_id: CHANNEL,
        parent_id: null,
        is_pinned: true,
        hearted: true,
      },
      {
        id: REPLY,
        target_type: 'video',
        target_id: VIDEO,
        channel_id: CHANNEL,
        parent_id: ROOT,
        is_pinned: false,
        hearted: false,
      },
      {
        id: ELSEWHERE,
        target_type: 'video',
        target_id: OTHER_VIDEO,
        channel_id: CHANNEL,
        parent_id: null,
        is_pinned: false,
        hearted: false,
      },
    ]);
    expect(await rows('select comment_id from comment_reports')).toEqual([{ comment_id: ROOT }]);
  });

  it('refuses a target type outside the vocabulary', async () => {
    await expect(
      database.engine.exec(commentOn(crypto.randomUUID(), 'playlist', VIDEO))
    ).rejects.toThrow(/comments_target_type_check/);
  });

  it('deletes a video comments, replies and reports with the video, and no one else comments', async () => {
    await database.engine.exec(`delete from videos where id = '${VIDEO}'`);

    expect(await rows('select id from comments')).toEqual([{ id: ELSEWHERE }]);
    expect(await rows('select comment_id from comment_reports')).toEqual([]);
  });

  it('deletes a post comments with the post', async () => {
    const comment = crypto.randomUUID();
    await database.engine.exec(`
      insert into channel_posts (id, channel_id, author_user_id, kind, payload, status)
        values ('${POST}', '${CHANNEL}', '${OWNER}', 'text', '{"kind":"text","text":"hi"}', 'published');
      ${commentOn(comment, 'post', POST)};
    `);
    await database.engine.exec(`delete from channel_posts where id = '${POST}'`);

    expect(await rows(`select id from comments where id = '${comment}'`)).toEqual([]);
  });

  it('deletes a thread comments with the thread, and a thread with its video', async () => {
    const comment = crypto.randomUUID();
    await database.engine.exec(`
      insert into video_threads (id, video_id, channel_id, author_id, author_channel_id, anchor_ms, title, body)
        values ('${THREAD}', '${OTHER_VIDEO}', '${CHANNEL}', '${FAN}', '${FAN_CHANNEL}', 1000, 'At one second', '');
      ${commentOn(comment, 'thread', THREAD)};
    `);
    await database.engine.exec(`delete from videos where id = '${OTHER_VIDEO}'`);

    expect(await rows('select id from video_threads')).toEqual([]);
    expect(await rows('select id from comments')).toEqual([]);
  });
});
