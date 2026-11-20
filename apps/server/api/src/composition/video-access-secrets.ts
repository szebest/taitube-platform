import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MS_PER_SECOND } from '@kit/primitives';
import type { UnlockCredentials, VideoAccessSecrets } from '../services/video-access-gate';

const SHARE_TOKEN_BYTES = 16;

function unlockCredentials(secret: string): UnlockCredentials {
  const mac = (videoId: string, passwordHash: string, expiresAt: string) =>
    createHmac('sha256', secret).update(`${videoId}\n${expiresAt}\n${passwordHash}`).digest();

  return {
    issue: (videoId, passwordHash, expiresAtMs) => {
      const expiresAt = String(Math.floor(expiresAtMs / MS_PER_SECOND));
      return `${expiresAt}.${mac(videoId, passwordHash, expiresAt).toString('base64url')}`;
    },
    verify: (videoId, passwordHash, credential, nowMs) => {
      const [expiresAt = '', signature = '', ...rest] = credential.split('.');
      if (rest.length > 0 || !/^\d{1,12}$/.test(expiresAt)) return false;
      if (Number(expiresAt) * MS_PER_SECOND <= nowMs) return false;

      const expected = mac(videoId, passwordHash, expiresAt);
      const presented = Buffer.from(signature, 'base64url');
      return presented.length === expected.length && timingSafeEqual(presented, expected);
    },
  };
}

/**
 * The credential is `<expiry seconds>.<HMAC-SHA256 over the video id, the expiry and the current
 * password hash>`, so a new or removed password ends every unlock made under the old one.
 */
export function videoAccessSecrets(secret: string | undefined): VideoAccessSecrets {
  return {
    newShareToken: () => randomBytes(SHARE_TOKEN_BYTES).toString('base64url'),
    unlock: secret === undefined ? null : unlockCredentials(secret),
  };
}
