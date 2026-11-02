import type { StorageClient } from '@vp/core/ports';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import { type ChannelNotFound, channelNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { DatabaseUnavailable, StorageUnavailable } from '@vp/errors';
import { andThen, err, isErr, ok, type Result } from '@vp/result';
import { channelImageKey, channelImagePrefix } from '@vp/storage';
import {
  CHANNEL_IMAGE_EXTENSIONS,
  type ChannelImageInput,
  type ChannelImageKind,
  type InvalidChannelImage,
  type InvalidField,
  invalidField,
  validateChannelImage,
} from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { cdnUrl } from './video-views';

export interface ChannelImageServiceDeps {
  channels: ChannelRepositoryPort;
  storage: StorageClient;
  publicBucket: string;
  cdn: CdnBase;
  presignedUrlTtlSeconds: number;
}

export interface ChannelImageUpload {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export type IssueChannelImageFailure =
  | InvalidChannelImage
  | ChannelNotFound
  | DatabaseUnavailable
  | StorageUnavailable;

export type ResolveChannelImageFailure = InvalidField | StorageUnavailable;

export interface ChannelImageChoice {
  avatarKey?: string;
  bannerKey?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
}

export interface ChannelImageAddresses {
  avatarUrl: string | null | undefined;
  bannerUrl: string | null | undefined;
}

const OBJECT_NAME = /^[\w-]+\.(?:jpg|png|webp)$/;

/** Avatars and banners of a channel, uploaded straight to the public bucket. Returns its failures; throws none. */
export class ChannelImageService {
  constructor(private readonly deps: ChannelImageServiceDeps) {}

  async issueUpload(
    userId: string,
    input: ChannelImageInput
  ): Promise<Result<ChannelImageUpload, IssueChannelImageFailure>> {
    const { channels, storage, publicBucket, presignedUrlTtlSeconds } = this.deps;

    const checked = validateChannelImage(input);
    if (isErr(checked)) return checked;

    const channel = await channels.findByUserId(userId);
    if (isErr(channel)) return channel;
    if (!channel.value) return err(channelNotFound(userId));

    const { kind, contentType, sizeBytes } = checked.value;
    const key = channelImageKey(
      channel.value.id,
      kind,
      uuidv7(),
      CHANNEL_IMAGE_EXTENSIONS[contentType as keyof typeof CHANNEL_IMAGE_EXTENSIONS]
    );

    const presigned = await storage.createPresignedPutUrl({
      bucket: publicBucket,
      key,
      contentType,
      contentLength: sizeBytes,
      expiresInSeconds: presignedUrlTtlSeconds,
    });

    return andThen(presigned, ({ url, headers, expiresAt }) =>
      ok({ key, uploadUrl: url, headers, expiresAt: expiresAt.toISOString() })
    );
  }

  /** Each field's address: the one an uploaded key stands for, else the address sent. */
  async addressesOf(
    channelId: string,
    choice: ChannelImageChoice
  ): Promise<Result<ChannelImageAddresses, ResolveChannelImageFailure>> {
    const avatarUrl = await this.addressOf(channelId, 'avatar', choice.avatarKey, choice.avatarUrl);
    if (isErr(avatarUrl)) return avatarUrl;

    const bannerUrl = await this.addressOf(channelId, 'banner', choice.bannerKey, choice.bannerUrl);
    if (isErr(bannerUrl)) return bannerUrl;

    return ok({ avatarUrl: avatarUrl.value, bannerUrl: bannerUrl.value });
  }

  private async addressOf(
    channelId: string,
    kind: ChannelImageKind,
    key: string | undefined,
    address: string | null | undefined
  ): Promise<Result<string | null | undefined, ResolveChannelImageFailure>> {
    return key === undefined ? ok(address) : this.resolve(channelId, kind, key);
  }

  /** The public address of an uploaded image, once the key is the channel's own and the object is there. */
  async resolve(
    channelId: string,
    kind: ChannelImageKind,
    key: string
  ): Promise<Result<string, ResolveChannelImageFailure>> {
    const field = `${kind}Key`;
    const prefix = channelImagePrefix(channelId, kind);
    if (!(key.startsWith(prefix) && OBJECT_NAME.test(key.slice(prefix.length)))) {
      return err(invalidField(field, `${field} is not an upload of this channel's ${kind}`, {}));
    }

    const head = await this.deps.storage.headObject(this.deps.publicBucket, key);
    if (isErr(head)) return head;
    if (head.value === null) {
      return err(invalidField(field, `${field} names no uploaded object`, {}));
    }

    return ok(cdnUrl(this.deps.cdn, key));
  }
}
