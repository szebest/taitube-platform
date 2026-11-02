import { InMemoryRepositories, InMemoryStorageClient } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { ChannelImageService } from '../channel-image-service';
import { channelImageServiceDeps, TEST_CDN, TEST_PUBLIC_BUCKET } from './service-deps';

const USER_ID = '018f0000-0000-7000-8000-000000000001';
const CHANNEL_ID = '018f0000-0000-7000-8000-000000000002';
const OTHER_CHANNEL_ID = '018f0000-0000-7000-8000-000000000003';

const AVATAR_CAP_BYTES = 5 * 1024 * 1024;
const AVATAR = { kind: 'avatar', contentType: 'image/png', sizeBytes: 1024 } as const;

async function setup() {
  const repositories = new InMemoryRepositories();
  repositories.clear();
  expectOk(await repositories.users.upsert({ id: USER_ID, email: 'a@example.com', tier: 'free' }));
  expectOk(
    await repositories.channels.create({
      id: CHANNEL_ID,
      userId: USER_ID,
      handle: 'creator',
      displayName: 'Creator',
    })
  );
  const storage = new InMemoryStorageClient();
  const service = new ChannelImageService(channelImageServiceDeps(repositories, { storage }));
  const upload = (key: string) =>
    storage.uploadObject({
      bucket: TEST_PUBLIC_BUCKET,
      key,
      body: Buffer.from('x'),
      contentType: 'image/png',
    });
  return { service, upload };
}

describe('ChannelImageService.issueUpload', () => {
  it("presigns a PUT for a key under the caller's own channel and kind", async () => {
    const { service } = await setup();

    const issued = expectOk(await service.issueUpload(USER_ID, AVATAR));

    expect(issued.key).toMatch(new RegExp(`^channels/${CHANNEL_ID}/avatar/[\\w-]+\\.png$`));
    expect(issued.uploadUrl).toContain(issued.key);
  });

  it.each([
    {
      name: 'a type that is no image',
      input: { ...AVATAR, contentType: 'image/gif' },
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
    {
      name: 'an avatar over its cap',
      input: { ...AVATAR, sizeBytes: AVATAR_CAP_BYTES + 1 },
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
  ])('refuses $name', async ({ input, code }) => {
    const { service } = await setup();

    expect(expectErr(await service.issueUpload(USER_ID, input)).code).toBe(code);
  });

  it('refuses a user with no channel', async () => {
    const { service } = await setup();

    expect(expectErr(await service.issueUpload('nobody', AVATAR)).code).toBe(
      ErrorCodes.CHANNEL_NOT_FOUND
    );
  });
});

describe('ChannelImageService.resolve', () => {
  it('answers the public address of an uploaded image', async () => {
    const { service, upload } = await setup();
    const key = `channels/${CHANNEL_ID}/banner/a1.webp`;
    await upload(key);

    expect(expectOk(await service.resolve(CHANNEL_ID, 'banner', key))).toBe(`${TEST_CDN}/${key}`);
  });

  it.each([
    { name: 'another channel', key: `channels/${OTHER_CHANNEL_ID}/avatar/a1.png`, uploaded: true },
    { name: 'the other kind', key: `channels/${CHANNEL_ID}/banner/a1.png`, uploaded: true },
    {
      name: 'a path that climbs out',
      key: `channels/${CHANNEL_ID}/avatar/../../${OTHER_CHANNEL_ID}/avatar/a1.png`,
      uploaded: true,
    },
    { name: 'nothing uploaded', key: `channels/${CHANNEL_ID}/avatar/missing.png`, uploaded: false },
  ])('refuses a key of $name', async ({ key, uploaded }) => {
    const { service, upload } = await setup();
    if (uploaded) await upload(key);

    const refused = expectErr(await service.resolve(CHANNEL_ID, 'avatar', key));

    expect(refused.code).toBe(ErrorCodes.VALIDATION_FAILED);
  });
});
