import { getTableConfig } from 'drizzle-orm/pg-core';
import { runMigrations } from '../migrate';
import {
  playlistActivity,
  playlistCollaborators,
  playlistFollows,
  playlistInvites,
  playlistPlaysDaily,
  playlistStatsDaily,
} from '../playlist-collaboration-schema';
import { referenceFrom } from './foreign-key';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const ownerId = crypto.randomUUID();
const playlistId = crypto.randomUUID();
const videoId = crypto.randomUUID();
const otherVideoId = crypto.randomUUID();
const silent = { info: () => undefined, warn: () => undefined };

describe('db: playlist collaboration schema', () => {
  it.each([
    {
      table: playlistCollaborators,
      column: 'playlist_id',
      target: 'playlists',
      onDelete: 'cascade',
    },
    { table: playlistCollaborators, column: 'user_id', target: 'users', onDelete: 'cascade' },
    { table: playlistInvites, column: 'playlist_id', target: 'playlists', onDelete: 'cascade' },
    { table: playlistInvites, column: 'invitee_user_id', target: 'users', onDelete: 'cascade' },
    { table: playlistInvites, column: 'created_by', target: 'users', onDelete: 'set null' },
    { table: playlistActivity, column: 'playlist_id', target: 'playlists', onDelete: 'cascade' },
    { table: playlistActivity, column: 'actor_user_id', target: 'users', onDelete: 'set null' },
    { table: playlistFollows, column: 'playlist_id', target: 'playlists', onDelete: 'cascade' },
    { table: playlistStatsDaily, column: 'playlist_id', target: 'playlists', onDelete: 'cascade' },
    { table: playlistPlaysDaily, column: 'video_id', target: 'videos', onDelete: 'cascade' },
  ])('$table.$column goes with $target ($onDelete)', ({ table, column, target, onDelete }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
  });

  it('finds an invite by its token, once', () => {
    const token = getTableConfig(playlistInvites).indexes.find(
      (index) => index.config.name === 'playlist_invites_token_idx'
    );

    expect(token?.config.unique).toBe(true);
  });
});

describe('db: 0048 playlist collaboration', () => {
  let database: SocketDatabase;

  const item = (fields: Record<string, unknown>) => {
    const row = { id: crypto.randomUUID(), playlist_id: playlistId, position: 0, ...fields };
    const columns = Object.keys(row);
    return database.engine.query(
      `insert into playlist_items (${columns.join(', ')}) values (${columns.map((_, n) => `$${n + 1}`).join(', ')})`,
      Object.values(row)
    );
  };

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, silent);
    await database.engine.exec(`
      insert into users (id, email) values ('${ownerId}', 'o@example.com');
      insert into channels (id, user_id, handle, display_name)
        values ('${ownerId}', '${ownerId}', 'owner', 'Owner');
      insert into videos (id, owner_id, channel_id, source_key)
        values ('${videoId}', '${ownerId}', '${ownerId}', 'raw/v.mp4'),
               ('${otherVideoId}', '${ownerId}', '${ownerId}', 'raw/w.mp4');
      insert into playlists (id, owner_id, title) values ('${playlistId}', '${ownerId}', 'Mix');
    `);
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    { scenario: 'a video item', fields: { video_id: videoId }, ok: true },
    { scenario: 'a section', fields: { kind: 'section', title: 'Part 1' }, ok: true },
    {
      scenario: 'a section with a video',
      fields: { kind: 'section', title: 'x', video_id: videoId },
      ok: false,
    },
    { scenario: 'a section without a title', fields: { kind: 'section' }, ok: false },
    { scenario: 'a video item without a video', fields: {}, ok: false },
    {
      scenario: 'an 81-character section title',
      fields: { kind: 'section', title: 's'.repeat(81) },
      ok: false,
    },
    {
      scenario: 'a segment under a second',
      fields: { video_id: otherVideoId, start_ms: 500, end_ms: 1499 },
      ok: false,
    },
  ])('stores $scenario: $ok', async ({ fields, ok }) => {
    const insert = item(fields);

    await (ok ? expect(insert).resolves.toBeDefined() : expect(insert).rejects.toThrow());
  });

  it('refuses an invite usable more than 20 times', async () => {
    const insert = database.engine.query(
      `insert into playlist_invites (id, playlist_id, role, token, expires_at, max_uses)
       values ($1, $2, 'editor', $3, now(), 21)`,
      [crypto.randomUUID(), playlistId, 't'.repeat(22)]
    );

    await expect(insert).rejects.toThrow();
  });

  it('lets a share link point at a playlist', async () => {
    const insert = database.engine.query(
      `insert into share_links (id, target_type, target_id, token) values ($1, 'playlist', $2, $3)`,
      [crypto.randomUUID(), playlistId, 's'.repeat(22)]
    );

    await expect(insert).resolves.toBeDefined();
  });

  it.each([
    { kind: 'playlist-cover', ok: true },
    { kind: 'poster', ok: false },
  ])('stores a $kind channel image upload: $ok', async ({ kind, ok }) => {
    const insert = database.engine.query(
      `insert into channel_image_uploads (id, channel_id, uploaded_by, kind, content_type, size_bytes)
       values ($1, $2, $2, $3, 'image/png', 1)`,
      [crypto.randomUUID(), ownerId, kind]
    );

    await (ok ? expect(insert).resolves.toBeDefined() : expect(insert).rejects.toThrow());
  });
});
