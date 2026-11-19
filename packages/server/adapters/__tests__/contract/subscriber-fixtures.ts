import { expectOk } from '@kit/testing/result';
import type { Repositories } from '@vp/core/repositories';
import { seedOwners } from './fixtures';

export const SUBSCRIBER_ID = '00000000-0000-7000-8000-000000000103';
/** The subscriber's primary channel, and a second channel of the same account. */
export const AS = '00000000-0000-7000-8000-000000000903';
export const AS_SECOND = '00000000-0000-7000-8000-000000000904';

/** The owners and their channels, and a subscriber who owns two channels. */
export async function seedSubscriber(repositories: Repositories): Promise<void> {
  await seedOwners(repositories);
  await repositories.users.upsert({ id: SUBSCRIBER_ID, email: 'subscriber@video-pipeline.local' });
  const { channels } = repositories;
  expectOk(
    await channels.create({ id: AS, userId: SUBSCRIBER_ID, handle: 'fan', displayName: 'Fan' })
  );
  expectOk(
    await channels.createOwned(
      { id: AS_SECOND, userId: SUBSCRIBER_ID, handle: 'fan-two', displayName: 'Fan Two' },
      5
    )
  );
}
