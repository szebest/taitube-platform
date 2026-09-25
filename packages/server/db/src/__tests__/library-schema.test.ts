import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { type PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { playlistItems, playlists, watchHistory } from '../library-schema';
import { referenceFrom } from './foreign-key';

function indexNamed(table: PgTable, name: string) {
  return getTableConfig(table).indexes.find((index) => index.config.name === name)?.config;
}

function uniqueColumns(table: PgTable): string[][] {
  return getTableConfig(table).uniqueConstraints.map((key) =>
    key.columns.map((column) => column.name)
  );
}

describe('db: library schema', () => {
  it.each([
    {
      scenario: 'a deleted user takes their playlists',
      table: playlists,
      column: 'owner_id',
      target: 'users',
    },
    {
      scenario: 'a deleted playlist takes its items',
      table: playlistItems,
      column: 'playlist_id',
      target: 'playlists',
    },
    {
      scenario: 'a purged video leaves every playlist',
      table: playlistItems,
      column: 'video_id',
      target: 'videos',
    },
    {
      scenario: 'a deleted user takes their history',
      table: watchHistory,
      column: 'user_id',
      target: 'users',
    },
    {
      scenario: 'a purged video leaves every history',
      table: watchHistory,
      column: 'video_id',
      target: 'videos',
    },
  ])('$scenario', ({ table, column, target }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete: 'cascade' });
  });

  it('holds one system playlist per owner', () => {
    const index = indexNamed(playlists, 'playlists_one_system_per_owner_idx');

    expect(index?.unique).toBe(true);
    expect(index?.where).toBeDefined();
  });

  it.each([
    {
      scenario: 'a video once per playlist',
      table: playlistItems,
      columns: ['playlist_id', 'video_id'],
    },
    {
      scenario: 'one history row per user and video',
      table: watchHistory,
      columns: ['user_id', 'video_id'],
    },
  ])('keeps $scenario', ({ table, columns }) => {
    expect(uniqueColumns(table)).toContainEqual(columns);
  });

  it.each([
    { table: playlists, name: 'playlists_visibility_check' },
    { table: watchHistory, name: 'watch_history_progress_check' },
  ])('guards $name in the database', ({ table, name }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toContain(name);
  });
});

const MIGRATIONS = join(import.meta.dirname, '../../drizzle');
const LIBRARY_MIGRATION = '0011_watch_later_playlists_and_history.sql';

async function apply(engine: PGlite, file: string): Promise<void> {
  for (const statement of readFileSync(join(MIGRATIONS, file), 'utf8').split(
    '--> statement-breakpoint'
  )) {
    await engine.exec(statement);
  }
}

describe('db: library migration', () => {
  it('gives every user who existed before it one Watch Later, and only one', async () => {
    const engine = new PGlite();
    const earlier = readdirSync(MIGRATIONS)
      .filter((file) => file.endsWith('.sql') && file < LIBRARY_MIGRATION)
      .sort();
    for (const file of earlier) await apply(engine, file);
    await engine.exec(
      "INSERT INTO users (id, email) VALUES ('00000000-0000-7000-8000-000000000001', 'a@x.local')"
    );

    await apply(engine, LIBRARY_MIGRATION);
    await expect(
      engine.exec(
        "INSERT INTO playlists (id, owner_id, title, is_system) VALUES ('00000000-0000-7000-8000-0000000000f1', '00000000-0000-7000-8000-000000000001', 'Second', true)"
      )
    ).rejects.toThrow();
    const { rows } = await engine.query<{ title: string; visibility: string }>(
      'SELECT title, visibility FROM playlists WHERE is_system'
    );
    await engine.close();

    expect(rows).toEqual([{ title: 'Watch Later', visibility: 'private' }]);
  });
});
