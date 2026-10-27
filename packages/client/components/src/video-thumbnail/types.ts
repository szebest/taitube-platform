import type { RadiusOption } from '@vp/design-tokens';
import type { MediaShape } from '@vp/ui';

export type VideoThumbnailAspect = Extract<MediaShape, 'video' | 'poster'>;
export type VideoThumbnailRadius = Extract<RadiusOption, 'thumb'>;
