import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import { NO_PLAYLIST_COUNTS } from '@vp/domain';
import { drizzle } from 'drizzle-orm/pglite';
import { OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { applyPlaylistStats } from '../playlist-stats-writes';
import { PostgresRepositories } from '../postgres-repositories';

const LIST = '00000000-0000-7000-8000-0000000001a1';
const DAY = '2026-11-20';

describe('applyPlaylistStats', () => {
  it('adds a play of a video gone since the beacon to the day, and to no video day', async () => {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    expectOk(await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a })));
    expectOk(
      await repositories.playlists.create({
        id: LIST,
        ownerId: OWNER_ID,
        title: 'Mix',
        description: '',
        visibility: 'public',
      })
    );
    const play = (videoId: string) => ({
      ...NO_PLAYLIST_COUNTS,
      playlistId: LIST,
      videoId,
      viewDate: DAY,
      plays: 1,
    });

    await applyPlaylistStats(db, [
      play(VIDEO_IDS.a),
      play(VIDEO_IDS.b),
      { ...play(VIDEO_IDS.a), playlistId: randomUUID() },
    ]);

    expect(await db.select().from(schema.playlistStatsDaily)).toEqual([
      { playlistId: LIST, day: DAY, opens: 0, plays: 2, follows: 0, forks: 0 },
    ]);
    expect(await db.select().from(schema.playlistPlaysDaily)).toEqual([
      { playlistId: LIST, videoId: VIDEO_IDS.a, day: DAY, plays: 1 },
    ]);
    await engine.close();
  });
});
