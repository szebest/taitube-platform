import type { PGlite } from '@electric-sql/pglite';
import type { SearchQuery } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { type SearchSource, channelSource, playlistSource, videoSource } from '../search-sources';
import type { PostgresDatabase } from '../types';

const ids = (prefix: string) =>
  [1, 2, 3].map((n) => `00000000-0000-7000-8000-0000000047${prefix}${n}`);
const USERS = ids('e');
const [OWNER = ''] = USERS;

function query(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return {
    text: 'alpha',
    kinds: ['video', 'channel', 'playlist'],
    sort: 'date',
    mode: 'lexical',
    instant: Date.now(),
    categoryId: null,
    cursor: null,
    limit: 1,
    ...overrides,
  };
}

describe('adapters/postgres: search sources', () => {
  let engine: PGlite;
  let db: PostgresDatabase;

  beforeAll(async () => {
    engine = await migratedPglite();
    db = drizzle(engine, { schema });
    await db.insert(schema.users).values(USERS.map((id) => ({ id, email: `${id}@x.local` })));
    await db.insert(schema.channels).values(
      USERS.map((userId, n) => ({
        id: userId,
        userId,
        handle: `alpha${n}`,
        displayName: 'Alpha',
      }))
    );
    await db.insert(schema.videos).values(
      ids('f').map((id): typeof schema.videos.$inferInsert => ({
        id,
        ownerId: OWNER,
        title: 'Alpha',
        visibility: 'public',
        status: 'READY',
        sourceKey: `raw/${id}`,
      }))
    );
    await db.insert(schema.playlists).values(
      ids('0').map((id): typeof schema.playlists.$inferInsert => ({
        id,
        ownerId: OWNER,
        title: 'Alpha',
        visibility: 'public',
      }))
    );
  });

  afterAll(async () => {
    await engine.close();
  });

  it.each<[string, SearchSource]>([
    ['video', videoSource],
    ['channel', channelSource],
    ['playlist', playlistSource],
  ])('cuts the %s page at the window and counts past the cursor', async (_kind, source) => {
    const [first, second] = await source.hits(db, query());
    const rest = await source.hits(db, query({ cursor: second ?? null }));

    expect([first, second].every(Boolean)).toBe(true);
    expect(rest.map((hit) => hit.id)).not.toContain(first?.id);
    expect(await source.total(db, query({ cursor: second ?? null }))).toBe(3);
  });
});
