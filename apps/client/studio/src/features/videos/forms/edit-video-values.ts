import type { Video } from '@vp/api-contracts';

import type { VideoEdit } from '../hooks/use-update-video';

export const NO_CATEGORY = 'none';

export interface EditVideoValues {
  title: string;
  description: string;
  visibility: Video['visibility'];
  categoryId: string;
  tags: string[];
  usePoster: boolean;
}

export function valuesOf(video: Video): EditVideoValues {
  return {
    title: video.title ?? '',
    description: video.description ?? '',
    visibility: video.visibility,
    categoryId: video.categoryId ?? NO_CATEGORY,
    tags: video.tags ?? [],
    usePoster: false,
  };
}

export function editOf(
  { categoryId, usePoster, ...values }: EditVideoValues,
  version: number
): VideoEdit {
  return {
    ...values,
    categoryId: categoryId === NO_CATEGORY ? null : categoryId,
    ...(usePoster && { selectedThumbnail: { source: 'poster' } }),
    version,
  };
}
