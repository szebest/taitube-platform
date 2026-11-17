import type { RadiusOption } from '@kit/design-tokens';
import type { MediaShape } from '@kit/ui';

export type VideoThumbnailAspect = Extract<MediaShape, 'video' | 'poster'>;
export type VideoThumbnailRadius = Extract<RadiusOption, 'thumb'>;
