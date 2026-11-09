import type { BannerTarget } from '@vp/domain';
import type { ChannelImageKind } from '@vp/validation';

export type ImageCropperKind = ChannelImageKind;
export type ImageCropperTarget = 'avatar' | BannerTarget;
export type ImageCropperStatus = 'editing' | 'queued' | 'ready' | 'failed';
