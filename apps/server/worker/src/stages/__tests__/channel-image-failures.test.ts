import { PermanentError, TransientError, storageUnavailable } from '@kit/errors';
import { err } from '@kit/result';
import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes, RETRY_CLASS } from '@vp/errors';
import { type ChannelImageProbe } from '@vp/ffmpeg';
import { channelImageUploadKey } from '@vp/storage';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import { useChannelImageStage } from './channel-image-harness';

describe('channel image stage failures', () => {
  const stage = useChannelImageStage();
  const { processor, queued, jobFor, status, channel, publicKeys, eventTypes } = stage;

  it.each([
    {
      scenario: 'a file ffprobe cannot decode',
      probed: new PermanentError(ErrorCodes.CORRUPT_CONTAINER, 'ffprobe error: Invalid data'),
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      scenario: 'dimensions past the cap',
      probed: new PermanentError(
        ErrorCodes.CORRUPT_CONTAINER,
        'Invalid image dimensions 9000x9000'
      ),
      code: ErrorCodes.CORRUPT_CONTAINER,
    },
    {
      scenario: 'a file that is no still JPEG, PNG or WebP',
      probed: new PermanentError(ErrorCodes.UNSUPPORTED_CODEC, 'Unsupported image codec "h264"'),
      code: ErrorCodes.UNSUPPORTED_CODEC,
    },
    {
      scenario: 'an image under the minimum',
      probed: { format: 'png', width: 120, height: 120 } satisfies ChannelImageProbe,
      code: ErrorCodes.IMAGE_TOO_SMALL,
    },
    {
      scenario: 'crops that do not fit the real dimensions',
      probed: { format: 'png', width: 300, height: 300 } satisfies ChannelImageProbe,
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('fails the upload for good on $scenario and keeps the old image', async ({ probed, code }) => {
    stage.probe = probed;
    const id = await queued('avatar');

    const failure = expectErr(await processor()(jobFor(id)));

    expect(failure.code).toBe(code);
    expect(RETRY_CLASS[failure.code]).toBe('permanent');
    expect(await status(id)).toBe('failed');
    expect(await publicKeys()).toEqual([]);
    expect(stage.rendered).toBe(0);
    expect(await channel()).toMatchObject({ avatarUrl: null, avatarVersion: 0 });
    expect(await eventTypes()).toEqual(['channel.image.failed']);
  });

  it('fails the upload for good when its raw file never arrived', async () => {
    const id = await queued('avatar', { raw: false });

    const failure = expectErr(await processor()(jobFor(id)));

    expect(failure.code).toBe(ErrorCodes.SOURCE_MISSING);
    expect(await status(id)).toBe('failed');
  });

  it('fails a real file of random bytes through the real ffprobe', async () => {
    const id = await queued('avatar');
    await stage.storage.uploadObject({
      bucket: 'raw',
      key: channelImageUploadKey(stage.channelId, 'avatar', id),
      body: Buffer.from('definitely not an image'),
      contentType: 'image/png',
    });

    const failure = expectErr(
      await processor({ probeChannelImage: STAGE_SETTINGS.media.probeChannelImage })(jobFor(id))
    );

    expect(RETRY_CLASS[failure.code]).toBe('permanent');
    expect(await status(id)).toBe('failed');
  });

  it.each([
    {
      settled: 'ready',
      settle: async (id: string) => expectOk(await processor()(jobFor(id))),
    },
    {
      settled: 'failed',
      settle: async (id: string) =>
        expectOk(await stage.repositories.channelImages.fail(id, 'unreadable')),
    },
    {
      settled: 'purged',
      settle: async (id: string) => {
        expectOk(await stage.repositories.channelImages.fail(id, 'unreadable'));
        return expectOk(await stage.repositories.channelImages.markPurged([id]));
      },
    },
  ])('is a no-op for an upload already $settled', async ({ settle }) => {
    const id = await queued('avatar');
    await settle(id);
    const commit = vi.spyOn(stage.repositories.channelImages, 'commit');
    stage.rendered = 0;

    expectOk(await processor()(jobFor(id)));

    expect(commit).not.toHaveBeenCalled();
    expect(stage.rendered).toBe(0);
  });

  it.each([
    {
      scenario: 'a stage.storage error',
      code: ErrorCodes.STORAGE_UNAVAILABLE,
      fail: () => {
        vi.spyOn(stage.storage, 'uploadObject').mockResolvedValue(
          err(storageUnavailable('uploadObject'))
        );
        return {};
      },
    },
    {
      scenario: 'an ffmpeg timeout',
      code: ErrorCodes.FFMPEG_TIMEOUT,
      fail: () => ({
        channelImage: () =>
          Promise.reject(new TransientError(ErrorCodes.FFMPEG_TIMEOUT, 'hard timeout')),
      }),
    },
  ])('keeps the upload queued after $scenario until the last attempt', async ({ code, fail }) => {
    const id = await queued('avatar');
    const run = processor(fail());
    const attempt = (attemptsMade: number) =>
      run(jobFor(id, 'avatar', { attemptsMade, opts: { attempts: 4 } }));

    expect(expectErr(await attempt(0)).code).toBe(code);
    expect(await status(id)).toBe('queued');
    expect(expectErr(await attempt(3)).code).toBe(code);
    expect(await status(id)).toBe('failed');
  });
});
