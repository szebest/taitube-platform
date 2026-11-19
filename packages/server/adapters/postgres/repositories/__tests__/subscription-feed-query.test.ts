import { expectOk } from '@kit/testing/result';
import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import {
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  VIDEO_IDS,
  publicVideo,
  seedOwners,
} from '../../../__tests__/contract/fixtures';
import { migratedPglite } from '../../../__tests__/contract/pglite-snapshot';
import { PostgresRepositories } from '../postgres-repositories';
import { subscriptionFeed } from '../subscription-feed-query';

const SUBSCRIBER_ID = '00000000-0000-7000-8000-000000000103';
const SUBSCRIBER_CHANNEL_ID = '00000000-0000-7000-8000-000000000903';
const SECOND_CHANNEL_ID = '00000000-0000-7000-8000-000000000904';

describe('adapters/postgres: subscription feed query', () => {
  it('lists the public ready videos of the followed channels once each, with the unpaged total', async () => {
    const db = drizzle(await migratedPglite(), { schema });
    const repositories = new PostgresRepositories({ type: 'drizzle', db });
    await seedOwners(repositories);
    await repositories.users.upsert({
      id: SUBSCRIBER_ID,
      email: 'subscriber@video-pipeline.local',
    });
    await repositories.channels.create({
      id: SUBSCRIBER_CHANNEL_ID,
      userId: SUBSCRIBER_ID,
      handle: 'fan',
      displayName: 'Fan',
    });
    await repositories.channels.createOwned(
      { id: SECOND_CHANNEL_ID, userId: SUBSCRIBER_ID, handle: 'fan-two', displayName: 'Fan Two' },
      5
    );
    for (const as of [SUBSCRIBER_CHANNEL_ID, SECOND_CHANNEL_ID]) {
      await repositories.subscriptions.subscribe(SUBSCRIBER_ID, as, OWNER_CHANNEL_ID);
    }
    await repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
    await repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
    await repositories.videos.create(publicVideo({ id: VIDEO_IDS.c, visibility: 'private' }));
    await repositories.videos.create(publicVideo({ id: VIDEO_IDS.d, ownerId: OTHER_OWNER_ID }));

    const feed = expectOk(await subscriptionFeed(db, SUBSCRIBER_ID, { limit: 1 }));

    expect(feed.total).toBe(2);
    expect(feed.items.map(({ id }) => id)).toEqual([VIDEO_IDS.b, VIDEO_IDS.a]);
  });
});
