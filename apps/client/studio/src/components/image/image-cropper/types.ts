import type { BannerTarget } from '@vp/domain';
import type { ChannelPageImageKind } from '@vp/validation';

export type ImageCropperKind = Exclude<ChannelPageImageKind, 'post-image' | 'page-image'>;
export type ImageCropperTarget = 'avatar' | BannerTarget;
export type ImageCropperStatus = 'editing' | 'queued' | 'ready' | 'failed';
