import { PgDialect } from 'drizzle-orm/pg-core';
import { runMigrations } from '../migrate';
import { searchVectors } from '../search-schema';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const quiet = { info: () => {}, warn: () => {} };
const USER = '00000000-0000-7000-8000-0000000047a1';

describe('db: search schema', () => {
  it.each([
    ['videos', searchVectors.videos],
    ['channels', searchVectors.channels],
    ['playlists', searchVectors.playlists],
  ])('names the %s vector with its table, so a join cannot make it ambiguous', (table, vector) => {
    expect(new PgDialect().sqlToQuery(vector).sql).toBe(`"${table}"."search_vector"`);
  });
});

describe('db: search migration', () => {
  let database: SocketDatabase;

  const vectorOf = async (table: string) =>
    (await database.engine.query<{ v: string }>(`select search_vector::text as v from ${table}`))
      .rows[0]?.v;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, quiet);
    await database.engine.exec(`
      insert into users (id, email) values ('${USER}', 'search@x.local');
      insert into channels (id, user_id, handle, display_name, bio)
        values ('${USER}', '${USER}', 'fireship', 'Fire Ship', 'short videos');
      insert into videos (id, owner_id, title, description, tags, source_key)
        values ('${USER}', '${USER}', 'Learn React', 'hooks', '{frontend}', 'raw/x.mp4');
      insert into playlists (id, owner_id, title, description, visibility)
        values ('${USER}', '${USER}', 'Coding Music', 'focus', 'public');
    `);
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each([
    ['videos', "'frontend':3B 'hooks':4 'learn':1A 'react':2A"],
    ['channels', "'fire':2A 'fireship':1A 'ship':3A 'short':4C 'videos':5C"],
    ['playlists', "'coding':1A 'focus':3B 'music':2A"],
  ])('weights the %s fields the ranking reads', async (table, vector) => {
    expect(await vectorOf(table)).toBe(vector);
  });

  it('recomputes a vector when the text it is built from changes', async () => {
    await database.engine.exec(`update videos set tags = '{backend}' where id = '${USER}'`);

    expect(await vectorOf('videos')).toContain("'backend':3B");
  });

  it('indexes the vectors and the fuzzy fallback columns, public playlists only', async () => {
    const { rows } = await database.engine.query<{ indexname: string; indexdef: string }>(
      "select indexname, indexdef from pg_indexes where indexname like '%search_vector%' or indexname like '%trgm%' order by indexname"
    );

    expect(rows.map((row) => row.indexname)).toEqual([
      'channels_display_name_trgm_idx',
      'channels_handle_trgm_idx',
      'channels_search_vector_idx',
      'playlists_search_vector_idx',
      'playlists_title_trgm_idx',
      'videos_search_vector_idx',
      'videos_title_trgm_idx',
    ]);
    expect(
      rows.filter((row) => row.indexname.startsWith('playlists')).map((row) => row.indexdef)
    ).toEqual([
      expect.stringContaining("WHERE ((visibility = 'public'::text) AND (NOT is_system))"),
      expect.stringContaining("WHERE ((visibility = 'public'::text) AND (NOT is_system))"),
    ]);
  });
});
