import { SECONDS_PER_HOUR } from '@kit/primitives';

export const VIDEO_PASSWORD_MIN_LENGTH = 4;
export const VIDEO_PASSWORD_MAX_LENGTH = 128;
export const VIDEO_UNLOCK_TTL_SECONDS = 12 * SECONDS_PER_HOUR;
export const VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE = 5;
