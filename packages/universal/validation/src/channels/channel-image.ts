/** What a channel's own image routes take; a playlist cover comes through the playlist's. */
export const CHANNEL_PAGE_IMAGE_KINDS = ['avatar', 'banner'] as const;

export const CHANNEL_IMAGE_KINDS = [...CHANNEL_PAGE_IMAGE_KINDS, 'playlist-cover'] as const;

export type ChannelImageKind = (typeof CHANNEL_IMAGE_KINDS)[number];

export type ChannelPageImageKind = (typeof CHANNEL_PAGE_IMAGE_KINDS)[number];

export const CHANNEL_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ChannelImageInput {
  readonly kind: ChannelImageKind;
  readonly contentType: string;
  readonly sizeBytes: number;
}
