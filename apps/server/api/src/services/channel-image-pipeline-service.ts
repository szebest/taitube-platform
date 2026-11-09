import type { JobQueue, StorageClient } from '@vp/core/ports';
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
import {
  type DatabaseUnavailable,
  ErrorCodes,
  type QueueUnavailable,
  type StorageUnavailable,
} from '@vp/errors';
import { defaultJobOptions, ids, stagePolicies, type ChannelImageJob } from '@vp/job-contracts';
import { createTraceparent, getActiveTraceparent } from '@vp/observability';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, err, isErr, map, ok } from '@vp/result';
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

/**
 * Avatars and banners: the file goes into the private bucket by presigned PUT, the crops come
 * with the completion, and a job cuts the variants. The channel keeps its image until that job
 * says otherwise, so nothing here changes what a visitor sees.
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

    const checked = validateChannelImageUploadRequest(request);
    if (isErr(checked)) return checked;

    const channel = await this.deps.channels.findById(acting.channelId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(acting.channelId));

    const { kind, contentType, sizeBytes } = checked.value;
    const uploadId = uuidv7();
    const presigned = await this.deps.storage.createPresignedPutUrl({
      bucket: this.deps.rawBucket,
      key: channelImageUploadKey(channel.value.id, kind, uploadId),
      contentType,
      contentLength: sizeBytes,
      expiresInSeconds: this.deps.presignedUrlTtlSeconds,
    });
    if (isErr(presigned)) return presigned;

    const recorded = await this.deps.images.create({
      id: uploadId,
      channelId: channel.value.id,
      uploadedBy: user.id,
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
  ): Promise<Result<{ uploadId: string; version: number }, CompleteImageFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-channel' });
    if (isErr(allowed)) return allowed;

    const upload = await this.ownUpload(acting.channelId, kind, input.uploadId);
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
      crops: decided.value.kind === 'avatar' ? decided.value.crop : decided.value.crops,
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
  { crop, crops }: CompleteImageInput
): Result<Parameters<typeof decideImageCrops>[0], InvalidField<Record<never, never>>> {
  if (kind === 'avatar') {
    return crop
      ? ok({ kind, crop })
      : err(invalidField('crop', 'An avatar needs a square crop', {}));
  }
  return crops
    ? ok({ kind, crops })
    : err(invalidField('crops', 'A banner needs a crop for desktop, mobile and tv', {}));
}
