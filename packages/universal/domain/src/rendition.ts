/** The ladder's rungs by name, tallest first; `@vp/job-contracts` holds each rung's encode settings. */
export const RENDITIONS = ['1080p', '720p', '480p'] as const;
export type RenditionName = (typeof RENDITIONS)[number];
