import * as schema from '@vp/db';
import type { ChannelPostCursor } from '@vp/domain';
import { drizzle } from 'drizzle-orm/pglite';
import { channelPostsPage, feedPostsPage, toChannelPost } from '../channel-post-queries';
import type { PostgresDatabase } from '../types';

const AT = new Date('2026-03-01T12:00:00.000Z');
const CURSOR: ChannelPostCursor = {
  pinnedAt: null,
  publishedAt: AT,
  id: '00000000-0000-7000-8000-0000000000a1',
};
const OPTIONS = { viewerId: 'viewer-1', cursor: null, limit: 24 };

function queryOf(run: (db: PostgresDatabase) => Promise<unknown>) {
  return new Promise<{ sql: string; params: unknown[] }>((resolve) => {
    const db = drizzle.mock({
      schema,
      logger: { logQuery: (sql, params) => resolve({ sql, params }) },
    });
    void run(db).catch(() => {});
  });
}

describe('channel post queries', () => {
  it('lists a channel published posts pinned first, newest next, one row past the page', async () => {
    const { sql, params } = await queryOf((db) => channelPostsPage(db, 'channel-1', OPTIONS));

    expect(sql).toContain('"channel_posts"."status" = $');
    expect(sql).toContain('coalesce(date_trunc(\'milliseconds\', "channel_posts"."pinned_at")');
    expect(sql).toMatch(
      /order by coalesce\(.*\) desc, date_trunc\(.*\) desc, "channel_posts"."id" desc/
    );
    expect(params).toEqual(expect.arrayContaining(['published', 'channel-1', 'viewer-1', 25]));
  });

  it('lists the feed newest first with no pinned rank, from the channels the subscriber follows', async () => {
    const { sql } = await queryOf((db) =>
      feedPostsPage(db, 'subscriber-1', { ...OPTIONS, cursor: CURSOR })
    );

    expect(sql).toContain('"channel_subscriptions"."subscriber_channel_id" = $');
    expect(sql).toMatch(/order by date_trunc\(.*\) desc, "channel_posts"."id" desc/);
    expect(sql).not.toMatch(/order by coalesce/);
  });

  it('drops the columns the domain post does not carry', () => {
    const post = toChannelPost({
      id: 'p-1',
      channelId: 'c-1',
      authorUserId: 'u-1',
      kind: 'text',
      payload: { kind: 'text', text: 'hi' },
      status: 'published',
      publishAt: null,
      publishedAt: AT,
      pinnedAt: null,
      commentsEnabled: true,
      likeCount: 0,
      commentsCount: 0,
      version: 1,
      editedAt: null,
      createdAt: AT,
      updatedAt: AT,
    });

    expect(post).not.toHaveProperty('kind');
    expect(post).not.toHaveProperty('updatedAt');
    expect(post).toMatchObject({ id: 'p-1', payload: { kind: 'text', text: 'hi' } });
  });
});
