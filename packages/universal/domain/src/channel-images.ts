export const BANNER_TARGETS = ['desktop', 'mobile', 'tv'] as const;

export type BannerTarget = (typeof BANNER_TARGETS)[number];

/** Width over height each banner target is cropped to. */
export const BANNER_ASPECTS: Readonly<Record<BannerTarget, number>> = {
  desktop: 6,
  mobile: 3,
  tv: 16 / 9,
};

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BannerCrops = Record<BannerTarget, CropRect>;

export const AVATAR_SIZES = [48, 72, 128, 256] as const;

export type AvatarSize = (typeof AVATAR_SIZES)[number];

export const BANNER_WIDTHS = [1280, 2560] as const;

export type BannerWidth = (typeof BANNER_WIDTHS)[number];

export const IMAGE_VARIANT_EXTENSION = 'webp';

export interface ChannelBannerLink {
  label: string;
  url: string;
}

export const HANDLE_CHANGE_COOLDOWN_DAYS = 30;

export const HANDLE_RESERVATION_DAYS = 90;

export const CONTACT_REVEALS_PER_DAY = 20;

export type ChannelImageKind = 'avatar' | 'banner';

export const IMAGE_UPLOAD_STATUSES = [
  'issued',
  'queued',
  'ready',
  'failed',
  'superseded',
  'purged',
] as const;

export type ImageUploadStatus = (typeof IMAGE_UPLOAD_STATUSES)[number];

/** One file a creator uploaded for an avatar or banner, from the presigned URL to the version it became. */
export interface ChannelImageUpload {
  id: string;
  channelId: string;
  uploadedBy: string;
  kind: ChannelImageKind;
  contentType: string;
  sizeBytes: number;
  status: ImageUploadStatus;
  width: number | null;
  height: number | null;
  crops: BannerCrops | CropRect | null;
  version: number | null;
  failure: string | null;
  createdAt: Date;
  updatedAt: Date;
}
