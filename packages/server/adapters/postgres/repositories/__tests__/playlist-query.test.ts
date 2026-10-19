import type { PGlite } from '@electric-sql/pglite';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { entriesOf, publicPlaylistsOf, writePositions } from '../playlist-query';
import type { PostgresDatabase } from '../types';

const OWNER = '00000000-0000-7000-8000-000000000101';
const OTHER = '00000000-0000-7000-8000-000000000102';
const PLAYLIST = '00000000-0000-7000-8000-0000000001a1';
const VIDEOS = ['0a', '0b', '0c'].map((tail) => `00000000-0000-7000-8000-0000000000${tail}`);
const ITEMS = ['1a', '1b', '1c'].map((tail) => `00000000-0000-7000-8000-0000000002${tail}`);

describe('adapters/postgres: playlist query', () => {
  let engine: PGlite;
  let db: PostgresDatabase;

  beforeAll(async () => {
    engine = await migratedPglite();
    db = drizzle(engine, { schema });
    await db.insert(schema.users).values([
      { id: OWNER, email: 'owner@x.local' },
      { id: OTHER, email: 'other@x.local' },
    ]);
    await db.insert(schema.videos).values(
      VIDEOS.map((id, index) => ({
        id,
        ownerId: index === 1 ? OTHER : OWNER,
        sourceKey: `raw/${id}/source.mp4`,
        visibility: index === 1 ? ('private' as const) : ('public' as const),
        status: 'READY' as const,
      }))
    );
    await db.insert(schema.playlists).values({ id: PLAYLIST, ownerId: OWNER, title: 'Mix' });
    await db.insert(schema.playlistItems).values(
      ITEMS.map((id, index) => ({
        id,
        playlistId: PLAYLIST,
        videoId: VIDEOS[index] ?? '',
        position: index * 1024,
      }))
    );
  });

  afterAll(async () => {
    await engine.close();
  });

  const listed = async (viewer: { id: string; role: 'USER' } | null) =>
    (await entriesOf(db, PLAYLIST, viewer)).map((row) => [row.videoId, row.position]);

  it('ranks every item before the viewer scope drops one', async () => {
    expect(await listed({ id: OWNER, role: 'USER' })).toEqual([
      [VIDEOS[0], 0],
      [VIDEOS[2], 2],
    ]);
    expect(await listed({ id: OTHER, role: 'USER' })).toEqual([
      [VIDEOS[0], 0],
      [VIDEOS[1], 1],
      [VIDEOS[2], 2],
    ]);
  });

  it('moves any number of rows in one statement, and touches no row it is not given', async () => {
    await writePositions(db, PLAYLIST, [
      { id: ITEMS[2] ?? '', position: -1024 },
      { id: ITEMS[0] ?? '', position: 4096 },
    ]);
    await writePositions(db, PLAYLIST, []);

    expect((await listed({ id: OTHER, role: 'USER' })).map(([videoId]) => videoId)).toEqual([
      VIDEOS[2],
      VIDEOS[1],
      VIDEOS[0],
    ]);
  });

  it('walks playlists changed in one millisecond a page at a time, none skipped and none repeated', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'].map(
      (tail) => `00000000-0000-7000-8000-0000000003${tail.charCodeAt(0).toString(16)}`
    );
    const micros = ['123400', '123999', '123456', '123402', '123401'];
    for (const [index, id] of ids.entries()) {
      await engine.query(
        `insert into playlists (id, owner_id, title, visibility, updated_at) values ($1, $2, 'Same', 'public', $3)`,
        [id, OWNER, `2026-10-19 10:00:00.${micros[index]}+00`]
      );
    }

    const walked: string[] = [];
    let cursor: { updatedAt: Date; id: string } | null = null;
    for (let page = 0; page < ids.length + 1; page++) {
      const [row] = await publicPlaylistsOf(db, OWNER, { cursor, limit: 1 });
      if (!row) break;
      walked.push(row.id);
      cursor = { updatedAt: row.updatedAt, id: row.id };
    }

    expect(walked).toEqual([...ids].sort().reverse());
  });
});
