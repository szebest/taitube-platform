import { type ChannelImageJob, ThumbnailQueueJob } from '@vp/job-contracts';
import { ok } from '@vp/result';
import { createMockJob } from '@vp/testing';
import { createThumbnailQueueProcessor } from '../thumbnail-queue-processor';

const VIDEO: Extract<ThumbnailQueueJob, { type: 'video-thumbnail' }> = {
  type: 'video-thumbnail',
  videoId: '11111111-1111-7111-8111-111111111111',
  generation: 1,
  traceparent: '00-01',
  sourceKey: 'raw/s.mp4',
  durationMs: 1000,
};
const IMAGE: ChannelImageJob = {
  type: 'channel-image',
  uploadId: '22222222-2222-7222-8222-222222222222',
  channelId: '33333333-3333-7333-8333-333333333333',
  kind: 'avatar',
  traceparent: '00-01',
};

describe('thumbnail queue stage', () => {
  const video = vi.fn(async () => ok('video'));
  const channelImage = vi.fn(async () => ok('image'));
  const process = createThumbnailQueueProcessor({ video, channelImage });

  beforeEach(() => {
    video.mockClear();
    channelImage.mockClear();
  });

  it.each([
    { scenario: 'a video thumbnail', data: VIDEO, called: video, other: channelImage },
    { scenario: 'a channel image', data: IMAGE, called: channelImage, other: video },
  ])('hands $scenario to its own processor only', async ({ data, called, other }) => {
    const job = createMockJob('thumbnail', data);

    await process(job);

    expect(called).toHaveBeenCalledOnce();
    expect(called).toHaveBeenCalledWith(job);
    expect(other).not.toHaveBeenCalled();
  });

  it('reads a payload that predates the tag as a video thumbnail', async () => {
    const { type: _, ...untagged } = VIDEO;
    const parsed = ThumbnailQueueJob.parse(untagged);

    await process(createMockJob('thumbnail', parsed));

    expect(video).toHaveBeenCalledOnce();
    expect(channelImage).not.toHaveBeenCalled();
  });
});
