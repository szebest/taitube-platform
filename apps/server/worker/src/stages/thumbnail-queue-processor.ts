import type { AnyFailure } from '@kit/errors';
import type { QueueJob } from '@kit/ports';
import { type Result, assertNever } from '@kit/result';
import type { ChannelImageJob, ThumbnailQueueJob } from '@vp/job-contracts';

type VideoThumbnailJob = Extract<ThumbnailQueueJob, { type: 'video-thumbnail' }>;

type Processor<T> = (job: QueueJob<T>) => Promise<Result<unknown, AnyFailure>>;

export interface ThumbnailQueueProcessors {
  video: Processor<VideoThumbnailJob>;
  channelImage: Processor<ChannelImageJob>;
}

/** The thumbnail queue carries video thumbnails and channel images; the payload's `type` picks the stage. */
export function createThumbnailQueueProcessor({ video, channelImage }: ThumbnailQueueProcessors) {
  return (job: QueueJob<ThumbnailQueueJob>): Promise<Result<unknown, AnyFailure>> => {
    const { data } = job;
    switch (data.type) {
      case 'video-thumbnail':
        return video({ ...job, data });
      case 'channel-image':
        return channelImage({ ...job, data });
      default:
        return assertNever(data, 'createThumbnailQueueProcessor');
    }
  };
}
