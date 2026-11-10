import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  channelCommentSettings,
  channelSavedReplies,
  channelTrustedCommenters,
  channelUserRestrictions,
  commentRemovals,
} from '../comment-moderation-schema';
import { videoComments } from '../comments-schema';
import { runMigrations } from '../migrate';
import { videos } from '../schema';
import { referenceFrom } from './foreign-key';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const silent = { info: () => undefined, warn: () => undefined };

describe('db: comment moderation schema', () => {
  it.each([
    {
      table: channelCommentSettings,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    {
      table: channelUserRestrictions,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    { table: channelUserRestrictions, column: 'user_id', target: 'users', onDelete: 'cascade' },
    { table: channelUserRestrictions, column: 'created_by', target: 'users', onDelete: 'set null' },
    {
      table: channelTrustedCommenters,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    { table: channelTrustedCommenters, column: 'user_id', target: 'users', onDelete: 'cascade' },
    { table: channelSavedReplies, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    { table: commentRemovals, column: 'video_id', target: 'videos', onDelete: 'cascade' },
    { table: commentRemovals, column: 'author_id', target: 'users', onDelete: 'cascade' },
    { table: commentRemovals, column: 'removed_by', target: 'users', onDelete: 'set null' },
    { table: videoComments, column: 'moderated_by', target: 'users', onDelete: 'set null' },
  ])(
    '$column of $table.name points at $target, on delete $onDelete',
    ({ table, column, target, onDelete }) => {
      expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
    }
  );

  it.each([
    { table: channelUserRestrictions, columns: ['channel_id', 'user_id'] },
    { table: channelTrustedCommenters, columns: ['channel_id', 'user_id'] },
  ])('keys $table.name by channel and user, so each is one row', ({ table, columns }) => {
    expect(getTableConfig(table).primaryKeys.map((key) => key.columns.map((c) => c.name))).toEqual([
      columns,
    ]);
  });

  it.each([
    {
      table: channelCommentSettings,
      checks: [
        'channel_comment_settings_review_mode_check',
        'channel_comment_settings_slow_mode_check',
        'channel_comment_settings_min_age_check',
      ],
    },
    {
      table: channelUserRestrictions,
      checks: [
        'channel_user_restrictions_kind_check',
        'channel_user_restrictions_expiry_check',
        'channel_user_restrictions_reason_check',
      ],
    },
    {
      table: channelSavedReplies,
      checks: ['channel_saved_replies_title_check', 'channel_saved_replies_body_check'],
    },
    {
      table: commentRemovals,
      checks: [
        'comment_removals_reason_check',
        'comment_removals_disclosure_check',
        'comment_removals_note_check',
      ],
    },
    {
      table: videoComments,
      checks: [
        'video_comments_moderation_state_check',
        'video_comments_moderation_disclosure_check',
        'video_comments_moderation_reason_check',
        'video_comments_held_reason_check',
      ],
    },
  ])('guards $table.name in the database', ({ table, checks }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toEqual(checks);
  });

  it('indexes only the comments that are not published', () => {
    const index = getTableConfig(videoComments).indexes.find(
      (candidate) => candidate.config.name === 'video_comments_moderation_idx'
    );

    expect(index?.config.where).toBeDefined();
  });

  it('turns comments on by default', () => {
    expect(videos.commentsEnabled.default).toBe(true);
  });
});

describe('db: 0035 restriction and settings checks', () => {
  let database: SocketDatabase;
  const userId = crypto.randomUUID();
  const channelId = crypto.randomUUID();

  const restrict = (kind: string, expiresAt: string | null) =>
    database.engine.query(
      `insert into channel_user_restrictions (channel_id, user_id, kind, expires_at)
       values ($1, $2, $3, $4) on conflict (channel_id, user_id) do update set kind = $3, expires_at = $4`,
      [channelId, userId, kind, expiresAt]
    );

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.query(
      `insert into users (id, email) values ('${userId}', 'u@example.com')`
    );
    await database.engine.query(
      `insert into channels (id, user_id, handle, display_name) values ('${channelId}', '${userId}', 'chan', 'Chan')`
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { kind: 'ban', expiresAt: '2030-01-01T00:00:00Z' },
    { kind: 'ban', expiresAt: null },
    { kind: 'shadow', expiresAt: null },
  ])('accepts a $kind that ends $expiresAt', async ({ kind, expiresAt }) => {
    await expect(restrict(kind, expiresAt)).resolves.toBeDefined();
  });

  it.each([
    { kind: 'shadow', expiresAt: '2030-01-01T00:00:00Z' },
    { kind: 'mute', expiresAt: null },
  ])('refuses a $kind that ends $expiresAt', async ({ kind, expiresAt }) => {
    await expect(restrict(kind, expiresAt)).rejects.toThrow();
  });

  it('gives a channel the default disclosure when it saves no settings of its own', async () => {
    await database.engine.query(
      `insert into channel_comment_settings (channel_id) values ('${channelId}')`
    );

    const { rows } = await database.engine.query<{ disclosure: Record<string, string> }>(
      `select disclosure from channel_comment_settings where channel_id = '${channelId}'`
    );

    expect(rows[0]?.disclosure).toMatchObject({ hide: 'silent', remove: 'visible' });
  });
});
