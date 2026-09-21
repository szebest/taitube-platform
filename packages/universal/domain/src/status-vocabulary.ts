export const VIDEO_STATUSES = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
  'DELETED',
] as const;

export const VIDEO_VISIBILITIES = ['private', 'unlisted', 'public'] as const;

export const STEP_STATUSES = ['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD'] as const;

export const UPLOAD_STATUSES = ['OPEN', 'COMPLETED', 'ABORTED'] as const;

export const RENDITION_STATUSES = ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED'] as const;

export const USER_ROLES = ['USER', 'CREATOR', 'MODERATOR', 'ADMIN'] as const;

export type VideoStatus = (typeof VIDEO_STATUSES)[number];
export type VideoVisibility = (typeof VIDEO_VISIBILITIES)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
export type RenditionStatus = (typeof RENDITION_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
