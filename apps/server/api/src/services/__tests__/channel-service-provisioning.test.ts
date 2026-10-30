import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { databaseUnavailable, ErrorCodes } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelService } from '../channel-service';
import { channelServiceDeps } from './service-deps';

const USER_ID = '018f0000-0000-7000-8000-000000000001';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';

describe('ChannelService.ensureProvisioned', () => {
  let repositories: InMemoryRepositories;
  let channelService: ChannelService;

  beforeEach(async () => {
    repositories = new InMemoryRepositories();
    channelService = new ChannelService(channelServiceDeps(repositories));
    expectOk(
      await repositories.users.upsert({ id: USER_ID, email: 'creator@example.com', tier: 'pro' })
    );
    expectOk(
      await repositories.channels.create({
        id: CHANNEL_ID,
        userId: USER_ID,
        handle: 'creator',
        displayName: 'Awesome Creator',
      })
    );
  });

  const NEW_USER_ID = '018f0000-0000-7000-8000-0000000000aa';

  it('creates the user and channel a first authenticated request implies', async () => {
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com'));

    expect(expectOk(await repositories.users.findById(NEW_USER_ID))).toMatchObject({
      email: 'ada@example.com',
      tier: 'free',
    });
    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
      handle: 'ada',
      displayName: 'ada',
    });
  });

  it('gives a new identity its private Watch Later, once however often it signs in', async () => {
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com'));
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com'));

    const owned = expectOk(
      await repositories.playlists.listOwned({ id: NEW_USER_ID, role: 'USER' }, null)
    );
    expect(owned).toMatchObject([{ title: 'Watch Later', visibility: 'private', isSystem: true }]);
  });

  it('creates no channel until Watch Later exists, so the next sign-in retries both', async () => {
    const provision = vi
      .spyOn(repositories.playlists, 'provisionWatchLater')
      .mockResolvedValueOnce(err(databaseUnavailable('provisionWatchLater')));

    const first = await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com');

    expect(expectErr(first).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toBeNull();

    provision.mockRestore();
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'ada@example.com'));
    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).not.toBeNull();
    expect(
      expectOk(await repositories.playlists.listOwned({ id: NEW_USER_ID, role: 'USER' }, null))
    ).toHaveLength(1);
  });

  it('synthesises an email when the identity carries none', async () => {
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID));

    expect(expectOk(await repositories.users.findById(NEW_USER_ID))).toMatchObject({
      email: `${NEW_USER_ID}@taitube.local`,
    });
    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
      displayName: 'User',
    });
  });

  it('is a no-op for an identity that already has a channel', async () => {
    expectOk(await channelService.ensureProvisioned(USER_ID, 'creator@example.com'));

    expect(expectOk(await repositories.channels.findByUserId(USER_ID))).toMatchObject({
      id: CHANNEL_ID,
      handle: 'creator',
    });
  });

  it('steps past a handle another channel already holds', async () => {
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'creator@example.com'));

    const channel = expectOk(await repositories.channels.findByUserId(NEW_USER_ID));

    expect(channel?.handle).not.toBe('creator');
    expect(channel?.handle).toMatch(/^creator_/);
  });

  it('never claims a reserved handle', async () => {
    expectOk(await channelService.ensureProvisioned(NEW_USER_ID, 'admin@example.com'));

    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toMatchObject({
      handle: 'u_admin',
    });
  });

  it('surfaces a dead store rather than leaving the caller without a channel', async () => {
    const broken = new ChannelService(
      channelServiceDeps(repositories, {
        channels: Object.assign(Object.create(repositories.channels), {
          findByUserId: async () => err(databaseUnavailable('findByUserId')),
        }),
      })
    );

    const provisioned = await broken.ensureProvisioned(NEW_USER_ID, 'ada@example.com');

    expect(expectErr(provisioned).code).toBe(ErrorCodes.DATABASE_UNAVAILABLE);
    expect(expectOk(await repositories.channels.findByUserId(NEW_USER_ID))).toBeNull();
  });
});
