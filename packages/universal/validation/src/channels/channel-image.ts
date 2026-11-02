import { andThen, ok, type Result } from '@vp/result';
import { validateContentType } from '../uploads/allowed-content-type';
import type { UnsupportedContentType, UploadTooLarge } from '../uploads/failures';
import { validateUploadSize } from '../uploads/upload-size';

export const CHANNEL_IMAGE_KINDS = ['avatar', 'banner'] as const;

export type ChannelImageKind = (typeof CHANNEL_IMAGE_KINDS)[number];

export const CHANNEL_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export const CHANNEL_IMAGE_CONTENT_TYPES = Object.keys(CHANNEL_IMAGE_EXTENSIONS);

const MEGABYTE = 1024 * 1024;

export const CHANNEL_IMAGE_MAX_BYTES: Readonly<Record<ChannelImageKind, number>> = {
  avatar: 5 * MEGABYTE,
  banner: 10 * MEGABYTE,
};

export interface ChannelImageInput {
  readonly kind: ChannelImageKind;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export type InvalidChannelImage = UnsupportedContentType | UploadTooLarge;

export function validateChannelImage({
  kind,
  contentType,
  sizeBytes,
}: ChannelImageInput): Result<ChannelImageInput, InvalidChannelImage> {
  return andThen(validateContentType(contentType, CHANNEL_IMAGE_CONTENT_TYPES), () =>
    andThen(validateUploadSize(sizeBytes, CHANNEL_IMAGE_MAX_BYTES[kind]), () =>
      ok({ kind, contentType, sizeBytes })
    )
  );
}
