import * as fs from 'node:fs/promises';
import { expectOk } from '@kit/testing/result';
import { planChannelImageVariants } from '@vp/ffmpeg';
import { channelImageVariantKey } from '@vp/storage';
import { uuidv7 } from 'uuidv7';
import { STAGE_SETTINGS } from '../../__tests__/stage-settings';
import {
  BANNER_CROPS,
  BANNER_PROBE,
  POST_IMAGE_PROBE,
  IMMUTABLE,
  useChannelImageStage,
} from './channel-image-harness';

describe('channel image stage', () => {
  const stage = useChannelImageStage();
  const { processor, queued, jobFor, status, channel, publicKeys, eventTypes } = stage;

  it('cuts four avatar sizes, uploads them immutable and commits the 128 px one', async () => {
    const id = await queued('avatar');
    const commit = vi.spyOn(stage.repositories.channelImages, 'commit');

    const result = expectOk(await processor()(jobFor(id)));

    expect(result).toEqual({ type: 'channel-image', uploadId: id, version: 1, applied: true });
    const keys = ['48', '72', '128', '256'].map((v) =>
      channelImageVariantKey(stage.channelId, 'avatar', v, 1)
    );
    expect((await publicKeys()).sort()).toEqual([...keys].sort());
    expect(expectOk(await stage.storage.headObject('public', keys[2] as string))).toMatchObject({
      contentType: 'image/webp',
      cacheControl: IMMUTABLE,
    });
    const defaultUrl = `${STAGE_SETTINGS.cdn}/${keys[2]}`;
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(id, defaultUrl);
    expect(await channel()).toMatchObject({ avatarUrl: defaultUrl, avatarVersion: 1 });
    expect(await status(id)).toBe('ready');
    expect(await fs.readdir(stage.tmpDir)).toEqual([]);
  });

  it('cuts six banner variants and commits desktop-1280', async () => {
    stage.probe = BANNER_PROBE;
    const id = await queued('banner');
    const commit = vi.spyOn(stage.repositories.channelImages, 'commit');

    expectOk(await processor()(jobFor(id, 'banner')));

    const names = planChannelImageVariants({ kind: 'banner', crops: BANNER_CROPS }).map(
      (v) => v.name
    );
    expect(names).toHaveLength(6);
    expect((await publicKeys()).sort()).toEqual(
      names.map((name) => channelImageVariantKey(stage.channelId, 'banner', name, 1)).sort()
    );
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(
      id,
      `${STAGE_SETTINGS.cdn}/${channelImageVariantKey(stage.channelId, 'banner', 'desktop-1280', 1)}`
    );
  });

  it('cuts two post image widths, commits their urls and leaves the channel images alone', async () => {
    stage.probe = POST_IMAGE_PROBE;
    const id = await queued('post-image');
    const commit = vi.spyOn(stage.repositories.channelImages, 'commit');

    expectOk(await processor()(jobFor(id, 'post-image')));

    const url = (name: string) =>
      `${STAGE_SETTINGS.cdn}/${channelImageVariantKey(stage.channelId, 'post-image', name, 1)}`;
    const urls = { w640: url('640'), w1280: url('1280') };
    expect((await publicKeys()).sort()).toEqual(
      ['640', '1280']
        .map((name) => channelImageVariantKey(stage.channelId, 'post-image', name, 1))
        .sort()
    );
    expect(commit).toHaveBeenCalledWith(id, urls.w1280, urls);
    expect(await channel()).toMatchObject({ avatarVersion: 0, bannerVersion: 0 });
    expect(await status(id)).toBe('ready');
  });

  it('answers a second run of the same job without a second commit or event', async () => {
    const id = await queued('avatar');
    const run = processor();
    expectOk(await run(jobFor(id)));
    const commit = vi.spyOn(stage.repositories.channelImages, 'commit');

    expect(expectOk(await run(jobFor(id)))).toMatchObject({ applied: false });

    expect(commit).not.toHaveBeenCalled();
    expect(await eventTypes()).toEqual(['channel.image.ready']);
  });

  it('answers a missing upload with a no-op', async () => {
    expectOk(await processor()(jobFor(uuidv7())));
    expect(stage.rendered).toBe(0);
  });

  it('supersedes an upload a newer version already replaced, leaving the live image alone', async () => {
    const older = await queued('avatar');
    const newer = await queued('avatar');
    expectOk(await processor()(jobFor(newer)));

    const result = expectOk(await processor()(jobFor(older)));

    expect(result).toMatchObject({ version: 1, applied: false });
    expect(await status(older)).toBe('superseded');
    expect(await channel()).toMatchObject({ avatarVersion: 2 });
  });
});
