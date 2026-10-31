import type { VideoSummary } from '@vp/api-contracts';
import { FEATURED_VIDEOS_MAX } from '@vp/domain';
import { useState } from 'react';

/** The pins being arranged: the saved ones until the creator changes them, never more than a shelf holds. */
export function useFeaturedDraft(saved: readonly VideoSummary[]) {
  const [pins, setPins] = useState(saved);

  const full = pins.length >= FEATURED_VIDEOS_MAX;
  const dirty = pins.length !== saved.length || pins.some(({ id }, at) => id !== saved[at]?.id);

  const add = (video: VideoSummary) =>
    setPins((current) =>
      current.length >= FEATURED_VIDEOS_MAX || current.some(({ id }) => id === video.id)
        ? current
        : [...current, video]
    );

  const remove = (videoId: string) =>
    setPins((current) => current.filter(({ id }) => id !== videoId));

  const reorder = (order: readonly string[]) =>
    setPins((current) => order.flatMap((id) => current.find((video) => video.id === id) ?? []));

  return { pins, full, dirty, add, remove, reorder };
}
