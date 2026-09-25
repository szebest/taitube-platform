import { SEEDED } from '@vp/testing';
import { runMigrations } from '../migrate';
import { seedDatabase } from '../seed';
import { type SocketDatabase, startSocketDatabase } from './socket-database';

const quiet = { info: () => {}, warn: () => {} };

describe('db: seedDatabase', () => {
  let database: SocketDatabase;

  beforeAll(async () => {
    database = await startSocketDatabase();
    await runMigrations(database.url, quiet);
    await seedDatabase(database.url, quiet);
    await seedDatabase(database.url, quiet);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function rows(sql: string): Promise<Record<string, unknown>[]> {
    return (await database.engine.query<Record<string, unknown>>(sql)).rows;
  }

  it('seeds the users the specs name, once however often it runs', async () => {
    expect(await rows('select id from users order by id')).toEqual([
      { id: SEEDED.userId },
      { id: SEEDED.otherUserId },
    ]);
  });

  it("seeds the dev user's public video and the other user's private one", async () => {
    expect(await rows('select id, owner_id, visibility, status from videos order by id')).toEqual([
      { id: SEEDED.videoId, owner_id: SEEDED.userId, visibility: 'public', status: 'READY' },
      {
        id: SEEDED.otherVideoId,
        owner_id: SEEDED.otherUserId,
        visibility: 'private',
        status: 'READY',
      },
    ]);
  });

  it('seeds a finished rendition of the public video for every rung of the ladder', async () => {
    expect(await rows('select name, status from renditions order by height desc')).toEqual([
      { name: '1080p', status: 'DONE' },
      { name: '720p', status: 'DONE' },
      { name: '480p', status: 'DONE' },
    ]);
  });
});
