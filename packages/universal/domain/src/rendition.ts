/** The ladder's rungs by name, tallest first; `@vp/job-contracts` holds each rung's encode settings. */
export const RENDITIONS = ['1080p', '720p', '480p'] as const;
export type RenditionName = (typeof RENDITIONS)[number];

/** The progress key the thumbnail stage reports under, beside the renditions; it never counts toward the overall. */
export const THUMBNAIL_PROGRESS = 'thumbnail';
