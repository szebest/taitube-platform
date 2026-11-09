import { type Result, andThen, err, ok } from '@vp/result';
import { validateContentType } from '../uploads/allowed-content-type';
import type { UnsupportedContentType, UploadTooLarge } from '../uploads/failures';
import { validateUploadSize } from '../uploads/upload-size';
import {
  CHANNEL_IMAGE_CONTENT_TYPES,
  type ChannelImageInput,
  type ChannelImageKind,
} from './channel-image';
import { type ImageTooSmall, imageTooSmall } from './failures';

const MEGABYTE = 1024 * 1024;

export const CHANNEL_IMAGE_UPLOAD_LIMITS: Readonly<
  Record<ChannelImageKind, { maxBytes: number; minWidth: number; minHeight: number }>
> = {
  avatar: { maxBytes: 2 * MEGABYTE, minWidth: 200, minHeight: 200 },
  banner: { maxBytes: 6 * MEGABYTE, minWidth: 1024, minHeight: 576 },
};

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** What the presigned upload is announced with: the type and the size cap of the kind. */
export function validateChannelImageUploadRequest({
  kind,
  contentType,
  sizeBytes,
}: ChannelImageInput): Result<ChannelImageInput, UnsupportedContentType | UploadTooLarge> {
  return andThen(validateContentType(contentType, CHANNEL_IMAGE_CONTENT_TYPES), () =>
    andThen(validateUploadSize(sizeBytes, CHANNEL_IMAGE_UPLOAD_LIMITS[kind].maxBytes), () =>
      ok({ kind, contentType, sizeBytes })
    )
  );
}

export function validateChannelImageDimensions(
  kind: ChannelImageKind,
  { width, height }: ImageDimensions
): Result<ImageDimensions, ImageTooSmall> {
  const { minWidth, minHeight } = CHANNEL_IMAGE_UPLOAD_LIMITS[kind];
  return width < minWidth || height < minHeight
    ? err(imageTooSmall({ width, height }, { minWidth, minHeight }))
    : ok({ width, height });
}
