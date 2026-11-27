import { expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OTHER_OWNER_ID,
  OWNER_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { followedCardsOf } from '../playlist-follow-query';
import { PostgresRepositories } from '../postgres-repositories';

const PUBLIC = '00000000-0000-7000-8000-0000000001a1';
const PRIVATE = '00000000-0000-7000-8000-0000000001a2';

describe('followedCardsOf', () => {
  it('cards what the follower may read, counting and posting only the videos they may watch', async () => {
    const engine = await migratedPglite();
    const db = drizzle(engine, { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    expectOk(
      await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a, visibility: 'private' }))
    );
    expectOk(
      await repositories.videos.create(publicVideo({ id: VIDEO_IDS.b, posterKey: 'posters/b.jpg' }))
    );
    for (const [id, visibility] of [
      [PUBLIC, 'public'],
      [PRIVATE, 'private'],
    ] as const) {
      expectOk(
        await repositories.playlists.create({
          id,
          ownerId: OWNER_ID,
          title: id,
          description: '',
          visibility,
        })
      );
    }
    for (const videoId of [VIDEO_IDS.a, VIDEO_IDS.b]) {
      expectOk(
        await repositories.playlists.addItem(
          PUBLIC,
          {
            id: `00000000-0000-7000-8000-0000000002${videoId.slice(-2)}`,
            videoId,
            addedBy: OWNER_ID,
          },
          OWNER_ID
        )
      );
    }

    const cards = await followedCardsOf(db, { id: OTHER_OWNER_ID, role: 'USER' }, [
      PUBLIC,
      PRIVATE,
    ]);

    expect([...cards.keys()]).toEqual([PUBLIC]);
    expect(cards.get(PUBLIC)).toMatchObject({
      videoCount: 1,
      posterKey: 'posters/b.jpg',
      isSmart: false,
    });
    expect(await followedCardsOf(db, { id: OTHER_OWNER_ID, role: 'USER' }, [])).toEqual(new Map());
    await engine.close();
  });
});
