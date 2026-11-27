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

export type ImageCrops =
  | { readonly kind: 'avatar'; readonly crop: CropRect }
  | { readonly kind: 'banner'; readonly crops: BannerCrops }
  | { readonly kind: 'playlist-cover'; readonly crop: CropRect }
  | { readonly kind: 'post-image'; readonly crop: CropRect };

export const AVATAR_SIZES = [48, 72, 128, 256] as const;

export const BANNER_WIDTHS = [1280, 2560] as const;

/** Width over height a playlist cover is cropped to, the shape of a video thumbnail. */
export const PLAYLIST_COVER_ASPECT = 16 / 9;

export const PLAYLIST_COVER_WIDTHS = [640, 1280] as const;

/** The variant a playlist keeps as its custom cover. */
export const PLAYLIST_COVER_KEPT_WIDTH: (typeof PLAYLIST_COVER_WIDTHS)[number] = 1280;

export const POST_IMAGE_WIDTHS = [640, 1280] as const;

export interface PostImageUrls {
  readonly w640: string;
  readonly w1280: string;
}

export interface PostImageVariants {
  readonly uploadId: string;
  readonly urls: PostImageUrls;
}

export interface ChannelBannerLink {
  label: string;
  url: string;
}

export const HANDLE_CHANGE_COOLDOWN_DAYS = 30;

export const HANDLE_RESERVATION_DAYS = 90;

export const CONTACT_REVEALS_PER_DAY = 20;

export type ChannelImageKind = 'avatar' | 'banner' | 'playlist-cover' | 'post-image';

export const IMAGE_UPLOAD_STATUSES = [
  'issued',
  'queued',
  'ready',
  'failed',
  'superseded',
  'purged',
] as const;

export type ImageUploadStatus = (typeof IMAGE_UPLOAD_STATUSES)[number];

/** Whether the job's variants of an upload are in the public bucket: cut, and not purged yet. */
export const IMAGE_UPLOAD_HAS_VARIANTS: Readonly<Record<ImageUploadStatus, boolean>> = {
  issued: false,
  queued: false,
  ready: true,
  failed: false,
  superseded: true,
  purged: false,
};

/**
 * Every edge of an upload's status. `CHANNEL_IMAGE_UPLOAD` in `@vp/domain-rules` is the machine
 * over it; the table lives here so the repositories can guard a write with the statuses it leaves.
 */
export const CHANNEL_IMAGE_UPLOAD_EDGES = {
  queue: { from: ['issued'], to: 'queued' },
  commit: { from: ['queued'], to: 'ready' },
  supersede: { from: ['queued'], to: 'superseded' },
  fail: { from: ['issued', 'queued'], to: 'failed' },
  purge: { from: ['issued', 'failed', 'superseded', 'ready'], to: 'purged' },
} as const satisfies Record<string, { from: readonly ImageUploadStatus[]; to: ImageUploadStatus }>;

/**
 * One file a creator uploaded for an avatar, a banner, a playlist cover or a post image, from the
 * presigned URL to the version it became.
 */
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
  crops: ImageCrops | null;
  version: number | null;
  variantUrls: PostImageUrls | null;
  failure: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_CHANNEL_IMAGE_EDGE = 8192;
export const MAX_CHANNEL_IMAGE_PIXELS = 40_000_000;
export const CHANNEL_IMAGE_QUALITY = 82;
export const CHANNEL_IMAGE_RETENTION_DAYS = 7;
