import {
  MAX_ACTIVE_SHARE_LINKS,
  SHARE_LINK_EXPIRIES,
  SHARE_LINK_LABEL_MAX_LENGTH,
  SHARE_LINK_TOKEN_LENGTH,
  VIDEO_PASSWORD_MAX_LENGTH,
  VIDEO_PASSWORD_MIN_LENGTH,
  VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE,
  VIDEO_UNLOCK_TTL_SECONDS,
} from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint';
import { VideoIdParamSchema } from './video-resource';

/** The query parameter a share link puts on `/watch/$id`, and that `GET /v1/videos/:id` reads. */
export const SHARE_TOKEN_PARAM = 's';

const VIDEO_ACCESS_COOKIE_PREFIX = 'vp.video-access.';

/** One cookie per unlocked video; the web's `/api` proxy forwards and re-issues only these. */
export function videoAccessCookieName(videoId: string): string {
  return `${VIDEO_ACCESS_COOKIE_PREFIX}${videoId}`;
}

export function isVideoAccessCookie(name: string): boolean {
  return name.startsWith(VIDEO_ACCESS_COOKIE_PREFIX);
}

export const ShareTokenSchema = z
  .string()
  .length(SHARE_LINK_TOKEN_LENGTH)
  .regex(/^[\w-]+$/)
  .describe(`A share link token, ${SHARE_LINK_TOKEN_LENGTH} URL-safe characters`);

const ShareLinkStateSchema = z.enum(['active', 'expired', 'revoked']);

export const ShareLinkSchema = z.object({
  id: z.uuid(),
  token: ShareTokenSchema,
  label: z.string().nullable(),
  expiresAt: z.string().nullable().describe('ISO 8601; null for a link that never expires'),
  revokedAt: z.string().nullable().describe('ISO 8601; null while not revoked'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  state: ShareLinkStateSchema,
  stats: z
    .object({
      opens: z.number().int().nonnegative().describe('Distinct viewers per day, added up'),
      views: z.number().int().nonnegative(),
      watchSeconds: z.number().int().nonnegative(),
    })
    .describe('Every flushed day so far; the last minutes are still in the buffer'),
});

const ShareLinkParamsSchema = VideoIdParamSchema.extend({ linkId: z.uuid() });

const AUTHENTICATED = {
  400: [ErrorCodes.VALIDATION_FAILED],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.VIDEO_NOT_FOUND],
};

export const listVideoShareLinks = defineEndpoint({
  method: 'GET',
  path: '/v1/creator/videos/:id/share-links',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'List the share links of a video',
  description:
    'Newest first, the expired and revoked ones included, each with its opens, views and watch seconds.',
  params: VideoIdParamSchema,
  status: 200,
  result: z.object({ items: z.array(ShareLinkSchema) }),
  errors: AUTHENTICATED,
});

export const createVideoShareLink = defineEndpoint({
  method: 'POST',
  path: '/v1/creator/videos/:id/share-links',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Create a share link',
  description: `A link opens /watch/:id?s=token and lets its holder watch the video whatever its visibility, and nothing else. At most ${MAX_ACTIVE_SHARE_LINKS} active links per video. An access gate on the page, the player and the API, not encryption: the segments sit in the public bucket under keys derived from the video id, so whoever holds the id can fetch them.`,
  params: VideoIdParamSchema,
  body: z.object({
    label: z
      .string()
      .optional()
      .describe(`A name for the creator, up to ${SHARE_LINK_LABEL_MAX_LENGTH} characters`),
    expiresIn: z.enum(SHARE_LINK_EXPIRIES).describe('How long the link works'),
  }),
  status: 201,
  result: ShareLinkSchema,
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.SHARE_LINK_LIMIT],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const revokeVideoShareLink = defineEndpoint({
  method: 'DELETE',
  path: '/v1/creator/videos/:id/share-links/:linkId',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Revoke a share link',
  description: 'The link answers 410 SHARE_LINK_EXPIRED from the next request on.',
  params: ShareLinkParamsSchema,
  status: 204,
  result: z.null(),
  errors: { ...AUTHENTICATED, 404: [ErrorCodes.VIDEO_NOT_FOUND, ErrorCodes.SHARE_LINK_NOT_FOUND] },
});

const PasswordBodySchema = z.object({
  password: z
    .string()
    .describe(`${VIDEO_PASSWORD_MIN_LENGTH} to ${VIDEO_PASSWORD_MAX_LENGTH} characters`),
});

export const setVideoPassword = defineEndpoint({
  method: 'PUT',
  path: '/v1/creator/videos/:id/password',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Protect an unlisted video with a password',
  description:
    'Only an unlisted video takes a password. It is stored as a salted scrypt hash and is never answered back. Setting a new one ends every unlock made with the old one.',
  params: VideoIdParamSchema,
  body: PasswordBodySchema,
  status: 200,
  result: z.object({ passwordProtected: z.literal(true) }),
  errors: {
    ...AUTHENTICATED,
    409: [ErrorCodes.VIDEO_PASSWORDS_OFF],
    422: [ErrorCodes.VALIDATION_FAILED],
  },
});

export const clearVideoPassword = defineEndpoint({
  method: 'DELETE',
  path: '/v1/creator/videos/:id/password',
  scope: 'videos:write',
  tag: 'Creator Studio',
  summary: 'Remove the password of a video',
  description: 'Every unlock made with the removed password ends with it.',
  params: VideoIdParamSchema,
  status: 204,
  result: z.null(),
  errors: AUTHENTICATED,
});

export const unlockVideo = defineEndpoint({
  method: 'POST',
  path: '/v1/videos/:id/unlock',
  scope: 'videos:read',
  anonymous: true,
  tag: 'Videos',
  summary: 'Unlock a password-protected video',
  description: `Sets a signed, httpOnly, SameSite=Lax cookie for this video that lasts ${VIDEO_UNLOCK_TTL_SECONDS / 3600} hours. ${VIDEO_UNLOCK_ATTEMPTS_PER_MINUTE} attempts a minute per client and video.`,
  params: VideoIdParamSchema,
  body: PasswordBodySchema,
  status: 204,
  result: z.null(),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    403: [ErrorCodes.VIDEO_PASSWORD_INVALID],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    409: [ErrorCodes.VIDEO_PASSWORDS_OFF],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export type ShareLinkView = z.infer<typeof ShareLinkSchema>;
