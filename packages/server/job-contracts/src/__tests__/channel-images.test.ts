import { ChannelImageJob, ThumbnailQueueJob, ids } from '../index';

const VIDEO_ID = '11111111-1111-7111-8111-111111111111';
const UPLOAD_ID = '22222222-2222-7222-8222-222222222222';
const CHANNEL_ID = '33333333-3333-7333-8333-333333333333';

const video = {
  videoId: VIDEO_ID,
  generation: 1,
  traceparent: '00-01',
  sourceKey: 'raw/s.mp4',
  durationMs: 1000,
};
const image = {
  type: 'channel-image',
  uploadId: UPLOAD_ID,
  channelId: CHANNEL_ID,
  kind: 'avatar',
  traceparent: '00-01',
};

describe('@vp/job-contracts: channel images', () => {
  it('derives the job id from the upload so a second enqueue is a no-op', () => {
    expect(ids.channelImage(UPLOAD_ID)).toBe(`${UPLOAD_ID}--channel-image`);
  });

  it.each([
    { name: 'an untagged payload', payload: video, type: 'video-thumbnail' },
    {
      name: 'a tagged video thumbnail',
      payload: { ...video, type: 'video-thumbnail' },
      type: 'video-thumbnail',
    },
    { name: 'a channel image', payload: image, type: 'channel-image' },
  ])('reads $name as a $type job', ({ payload, type }) => {
    expect(ThumbnailQueueJob.safeParse(payload)).toMatchObject({
      success: true,
      data: { type },
    });
  });

  it.each([
    { name: 'an unknown type', payload: { ...image, type: 'avatar' } },
    { name: 'a bad kind', payload: { ...image, kind: 'cover' } },
    { name: 'a bad upload id', payload: { ...image, uploadId: 'x' } },
    { name: 'an untagged payload missing its source', payload: { ...video, sourceKey: undefined } },
    { name: 'a non-object', payload: 'job' },
  ])('rejects $name', ({ payload }) => {
    expect(ThumbnailQueueJob.safeParse(payload).success).toBe(false);
  });

  it('keeps the optional request id on a channel image job', () => {
    expect(ChannelImageJob.parse({ ...image, requestId: 'req-1' }).requestId).toBe('req-1');
  });
});
