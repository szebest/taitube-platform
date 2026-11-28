import {
  type DatabaseUnavailable,
  type QueueUnavailable,
  type StorageUnavailable,
} from '@kit/errors';
import { createTraceparent, getActiveTraceparent } from '@kit/observability';
import type { JobQueue } from '@kit/ports';
import { type Result, andThen, assertNever, err, isErr, map, ok } from '@kit/result';
import type { StorageClient } from '@vp/core/ports';
import type { ChannelImageRepositoryPort, ChannelRepositoryPort } from '@vp/core/repositories';
import type { BannerCrops, ChannelImageKind, ChannelImageUpload, CropRect } from '@vp/domain';
import type { ActingChannel } from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChannelNotFound,
  type DecideImageCropsFailure,
  type ImageUploadNotFound,
  channelNotFound,
  decideChannelTask,
  decideImageCrops,
  imageUploadNotFound,
} from '@vp/domain-rules';
import { ErrorCodes } from '@vp/errors';
import { defaultJobOptions, ids, stagePolicies, type ChannelImageJob } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { channelImageUploadKey } from '@vp/storage';
import {
  type ImageDimensions,
  type InvalidField,
  type UnsupportedContentType,
  type UploadTooLarge,
  invalidField,
  unsupportedContentType,
  validateChannelImageUploadRequest,
  CHANNEL_IMAGE_CONTENT_TYPES,
} from '@vp/validation';
import { uuidv7 } from 'uuidv7';

const THUMBNAIL_QUEUE = 'thumbnail';

export interface ChannelImagePipelineServiceDeps {
  channels: ChannelRepositoryPort;
  images: ChannelImageRepositoryPort;
  storage: StorageClient;
  rawBucket: string;
  presignedUrlTtlSeconds: number;
  queue: JobQueue;
}

export interface PreparedImageUpload {
  uploadId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface QueuedImageUpload {
  uploadId: string;
  version: number;
}

export interface CompleteImageInput {
  uploadId: string;
  width: number;
  height: number;
  crop?: CropRect;
  crops?: BannerCrops;
}

export type PrepareImageFailure =
  | AuthorizationFailure
  | UnsupportedContentType
  | UploadTooLarge
  | ChannelNotFound
  | DatabaseUnavailable
  | StorageUnavailable;

export type CompleteImageFailure =
  | AuthorizationFailure
  | ImageUploadNotFound
  | InvalidField<Record<never, never>>
  | UnsupportedContentType
  | DecideImageCropsFailure
  | {
      readonly code: typeof ErrorCodes.UPLOAD_SIZE_MISMATCH;
      readonly message: string;
      readonly declaredSizeBytes: number;
      readonly actualSizeBytes: number;
    }
  | DatabaseUnavailable
  | StorageUnavailable
  | QueueUnavailable;

/** What `prepareUpload` records the file under: the channel it belongs to and who sent it. */
export interface ImageOwner {
  channelId: string;
  uploadedBy: string;
}

/**
 * Avatars, banners, playlist covers and post images: the file goes into the private bucket by presigned PUT,
 * the crops come with the completion, and a job cuts the variants. The channel keeps its image
 * until that job says otherwise, so nothing here changes what a visitor sees. `prepare` and
 * `complete` are a channel's own images; a playlist cover is authorised by its playlist and comes
 * through `prepareUpload` and `queueUpload`.
 */
export class ChannelImagePipelineService {
  constructor(private readonly deps: ChannelImagePipelineServiceDeps) {}

  async prepare(
    user: UserContext,
    acting: ActingChannel,
    request: { kind: ChannelImageKind; contentType: string; sizeBytes: number }
  ): Promise<Result<PreparedImageUpload, PrepareImageFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;

    const channel = await this.deps.channels.findById(acting.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(acting.channelId));

    return await this.prepareUpload({ channelId: channel.value.id, uploadedBy: user.id }, request);
  }

  async prepareUpload(
    { channelId, uploadedBy }: ImageOwner,
    request: { kind: ChannelImageKind; contentType: string; sizeBytes: number }
  ): Promise<Result<PreparedImageUpload, PrepareImageFailure>> {
    const checked = validateChannelImageUploadRequest(request);
    if (isErr(checked)) return checked;

    const { kind, contentType, sizeBytes } = checked.value;
    const uploadId = uuidv7();
    const presigned = await this.deps.storage.createPresignedPutUrl({
      bucket: this.deps.rawBucket,
      key: channelImageUploadKey(channelId, kind, uploadId),
      contentType,
      contentLength: sizeBytes,
      expiresInSeconds: this.deps.presignedUrlTtlSeconds,
    });
    if (isErr(presigned)) return presigned;

    const recorded = await this.deps.images.create({
      id: uploadId,
      channelId,
      uploadedBy,
      kind,
      contentType,
      sizeBytes,
    });
    return map(
      andThen(recorded, () => presigned),
      ({ url, headers, expiresAt }) => ({
        uploadId,
        uploadUrl: url,
        headers,
        expiresAt: expiresAt.toISOString(),
      })
    );
  }

  async complete(
    user: UserContext,
    acting: ActingChannel,
    kind: ChannelImageKind,
    input: CompleteImageInput
  ): Promise<Result<QueuedImageUpload, CompleteImageFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;
    return await this.queueUpload(acting.channelId, kind, input);
  }

  async queueUpload(
    channelId: string,
    kind: ChannelImageKind,
    input: CompleteImageInput
  ): Promise<Result<QueuedImageUpload, CompleteImageFailure>> {
    const upload = await this.ownUpload(channelId, kind, input.uploadId);
    if (isErr(upload)) return upload;

    const uploaded = await this.checkObject(upload.value);
    if (isErr(uploaded)) return uploaded;

    const crops = decideCrops(kind, input);
    if (isErr(crops)) return crops;
    const image: ImageDimensions = { width: input.width, height: input.height };
    const decided = decideImageCrops(crops.value, image);
    if (isErr(decided)) return decided;

    const queued = await this.deps.images.queue(upload.value.id, {
      ...image,
      crops: decided.value,
    });
    if (isErr(queued)) return queued;
    if (!queued.value?.version) return err(imageUploadNotFound(input.uploadId));

    const enqueued = await this.enqueue(queued.value);
    return map(enqueued, () => ({
      uploadId: queued.value?.id ?? input.uploadId,
      version: queued.value?.version ?? 0,
    }));
  }

  private async ownUpload(
    channelId: string,
    kind: ChannelImageKind,
    uploadId: string
  ): Promise<Result<ChannelImageUpload, ImageUploadNotFound | DatabaseUnavailable>> {
    const found = await this.deps.images.findById(uploadId);
    if (isErr(found)) return found;
    const upload = found.value;
    return upload && upload.channelId === channelId && upload.kind === kind
      ? ok(upload)
      : err(imageUploadNotFound(uploadId));
  }

  /** What the browser put in the bucket is what it announced: the stored size and type, nothing else. */
  private async checkObject(
    upload: ChannelImageUpload
  ): Promise<Result<void, CompleteImageFailure>> {
    const head = await this.deps.storage.headObject(
      this.deps.rawBucket,
      channelImageUploadKey(upload.channelId, upload.kind, upload.id)
    );
    if (isErr(head)) return head;
    if (!head.value) return err(imageUploadNotFound(upload.id));

    if (head.value.contentLength !== upload.sizeBytes) {
      return err({
        code: ErrorCodes.UPLOAD_SIZE_MISMATCH,
        message: `Uploaded object size (${head.value.contentLength}) does not match declared size (${upload.sizeBytes})`,
        declaredSizeBytes: upload.sizeBytes,
        actualSizeBytes: head.value.contentLength,
      });
    }
    return head.value.contentType === upload.contentType
      ? ok()
      : err(unsupportedContentType(head.value.contentType ?? '', CHANNEL_IMAGE_CONTENT_TYPES));
  }

  private async enqueue(upload: ChannelImageUpload): Promise<Result<void, QueueUnavailable>> {
    const job: ChannelImageJob = {
      type: 'channel-image',
      uploadId: upload.id,
      channelId: upload.channelId,
      kind: upload.kind,
      traceparent: getActiveTraceparent() ?? createTraceparent(),
    };
    const added = await this.deps.queue.add(THUMBNAIL_QUEUE, job, {
      jobId: ids.channelImage(upload.id),
      ...stagePolicies.thumbnail,
      ...defaultJobOptions,
    });
    return isErr(added) ? added : ok();
  }
}

function decideCrops(
  kind: ChannelImageKind,
  { crop, crops, width, height }: CompleteImageInput
): Result<Parameters<typeof decideImageCrops>[0], InvalidField<Record<never, never>>> {
  switch (kind) {
    case 'avatar':
      return crop
        ? ok({ kind, crop })
        : err(invalidField('crop', 'An avatar needs a square crop', {}));
    case 'banner':
      return crops
        ? ok({ kind, crops })
        : err(invalidField('crops', 'A banner needs a crop for desktop, mobile and tv', {}));
    case 'playlist-cover':
      return crop
        ? ok({ kind, crop })
        : err(invalidField('crop', 'A playlist cover needs a 16:9 crop', {}));
    case 'post-image':
      return ok({ kind, crop: { x: 0, y: 0, width, height } });
    default:
      return assertNever(kind, 'ChannelImageKind');
  }
}
