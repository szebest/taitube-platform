export const FEATURED_VIDEOS_MAX = 6;

export const FEATURED_SOURCES = ['pinned', 'popular'] as const;

export type FeaturedSource = (typeof FEATURED_SOURCES)[number];
