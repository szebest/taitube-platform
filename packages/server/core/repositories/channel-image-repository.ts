import type { BannerCrops, ChannelImageKind, ChannelImageUpload, CropRect } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface NewChannelImageUpload {
  id: string;
  channelId: string;
  uploadedBy: string;
  kind: ChannelImageKind;
  contentType: string;
  sizeBytes: number;
}

export interface ChannelImageCompletion {
  width: number;
  height: number;
  crops: BannerCrops | CropRect;
}

export interface ChannelImageCommit {
  upload: ChannelImageUpload;
  /** False when a newer version of the same image got there first: this upload is `superseded`. */
  applied: boolean;
}

/**
 * The files behind a channel's avatar and banner and the versions they became. A version only
 * moves forward: committing one that is not newer than the channel's current version changes
 * nothing visible, so a retried or late job cannot bring an old image back.
 */
export interface ChannelImageRepositoryPort {
  create(input: NewChannelImageUpload): Promise<Result<ChannelImageUpload, DatabaseUnavailable>>;
  findById(id: string): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>>;
  /**
   * `issued` to `queued`, with the dimensions and crops the job will cut and the next version of
   * this channel's kind. A second call for an upload already queued answers it unchanged, and
   * answers `null` for one that is missing or has moved on.
   */
  queue(
    id: string,
    completion: ChannelImageCompletion
  ): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>>;
  /**
   * One write: the upload becomes `ready`, the channel's version moves to it when it is newer and
   * its `avatarUrl` or `bannerUrl` becomes `defaultUrl`, the address of the variant that stands for
   * the image wherever only one is shown, and the uploader is told. Committing an upload that is already `ready` or `superseded` repeats
   * that outcome and writes nothing more.
   */
  commit(id: string, defaultUrl: string): Promise<Result<ChannelImageCommit | null, DatabaseUnavailable>>;
  /** The upload becomes `failed` and the uploader is told; the channel keeps its image. */
  fail(id: string, reason: string): Promise<Result<ChannelImageUpload | null, DatabaseUnavailable>>;
  /** Versions a newer one replaced, and files that never became one, oldest first. */
  listPurgeable(
    olderThan: Date,
    limit: number
  ): Promise<Result<ChannelImageUpload[], DatabaseUnavailable>>;
  markPurged(ids: readonly string[]): Promise<Result<void, DatabaseUnavailable>>;
}
