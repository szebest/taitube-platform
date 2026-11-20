import {
  VIEWER_SESSION_HEADER,
  ViewerSessionKeySchema,
  videoAccessCookieName,
} from '@vp/api-contracts';
import { parseCookie } from 'cookie-es';
import type { FastifyRequest } from 'fastify';
import type { VideoAccess, WatchRequest } from '../services/index';

const MAX_CREDENTIAL_LENGTH = 128;

/** A test variant makes a listing one viewer's alone. */
export const PER_VIEWER_HEADERS = {
  'Cache-Control': 'private, no-cache',
  Vary: `Authorization, ${VIEWER_SESSION_HEADER}`,
};

/** So does a share link or an unlock cookie on a read of one video. */
export const GATED_READ_HEADERS = {
  ...PER_VIEWER_HEADERS,
  Vary: `Authorization, Cookie, ${VIEWER_SESSION_HEADER}`,
};

/** The tab's session key; a missing or malformed header is no key, and the control is served. */
export function viewerSessionOf(request: FastifyRequest): string | null {
  const parsed = ViewerSessionKeySchema.safeParse(request.headers[VIEWER_SESSION_HEADER]);
  return parsed.success ? parsed.data : null;
}

/** The share token in `s` and the unlock cookie of this video, which the web's proxy forwards. */
export function videoAccessOf(
  request: FastifyRequest,
  videoId: string,
  shareToken: string | undefined
): VideoAccess {
  const { cookie } = request.headers;
  const credential =
    cookie === undefined ? undefined : parseCookie(cookie)[videoAccessCookieName(videoId)];
  return {
    shareToken: shareToken ?? null,
    credential:
      credential === undefined || credential.length > MAX_CREDENTIAL_LENGTH ? null : credential,
  };
}

export function watchRequestOf(
  request: FastifyRequest,
  videoId: string,
  shareToken: string | undefined
): WatchRequest {
  return { ...videoAccessOf(request, videoId, shareToken), sessionKey: viewerSessionOf(request) };
}
