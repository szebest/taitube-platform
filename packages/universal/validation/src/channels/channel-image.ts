export const CHANNEL_IMAGE_KINDS = ['avatar', 'banner'] as const;

export type ChannelImageKind = (typeof CHANNEL_IMAGE_KINDS)[number];

export const CHANNEL_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ChannelImageInput {
  readonly kind: ChannelImageKind;
  readonly contentType: string;
  readonly sizeBytes: number;
}
