import { type Result, isErr, map, ok } from '@kit/result';
import type { ShareLinkRepository, VideoPasswordRepository } from '@vp/core/repositories';
import type { ShareLink, Video } from '@vp/domain';
import {
  type ReadVideoFailure,
  type ShareLinkExpired,
  type VideoPasswordRequired,
  decideShareLinkUse,
  decideVideoGate,
  decideVideoRead,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { ShareGrant, UserContext } from '@vp/permissions';

/** The signed value an unlock sets as the video's cookie, bound to the password hash it was made under. */
export interface UnlockCredentials {
  issue(videoId: string, passwordHash: string, expiresAtMs: number): string;
  /** `false` for a forged, expired or malformed credential, and for one made under another password. */
  verify(videoId: string, passwordHash: string, credential: string, nowMs: number): boolean;
}

export interface VideoAccessSecrets {
  newShareToken(): string;
  /** Null without `VIDEO_ACCESS_SECRET`: nothing can be unlocked, so no password can be set. */
  unlock: UnlockCredentials | null;
}

/** What a public read of one video carries beside the caller's identity. */
export interface VideoAccess {
  readonly shareToken: string | null;
  readonly credential: string | null;
}

export const NO_VIDEO_ACCESS: VideoAccess = { shareToken: null, credential: null };

export interface GatedVideo {
  readonly video: Video;
  /** The live link that let the read through. */
  readonly link: ShareLink | null;
}

export type GatedReadFailure =
  | ReadVideoFailure
  | ShareLinkExpired
  | VideoPasswordRequired
  | DatabaseUnavailable;

export interface VideoAccessGateDeps {
  shareLinks: ShareLinkRepository;
  passwords: VideoPasswordRepository;
  unlock: UnlockCredentials | null;
  now: () => number;
}

interface UsedLink {
  readonly link: ShareLink;
  readonly grant: ShareGrant;
}

/**
 * A public read of one video, after the caller found it: the share link first, then the read with
 * what the link grants, then the password. A token of another video proves nothing, and the
 * password hash is read only for a video that has one.
 */
export class VideoAccessGate {
  constructor(private readonly deps: VideoAccessGateDeps) {}

  async read(
    viewer: UserContext | null,
    video: Video | null,
    videoId: string,
    access: VideoAccess
  ): Promise<Result<GatedVideo, GatedReadFailure>> {
    const used = await this.linkOf(video === null ? null : access.shareToken, videoId);
    if (isErr(used)) return used;
    const share = used.value?.grant ?? null;

    const readable = decideVideoRead({ viewer, video, videoId, share });
    if (isErr(readable)) return readable;

    const unlocked = await this.unlocked(readable.value, access.credential);
    if (isErr(unlocked)) return unlocked;

    const gated = decideVideoGate({
      viewer,
      video: readable.value,
      unlocked: unlocked.value,
      share,
    });
    return map(gated, (passed) => ({ video: passed, link: used.value?.link ?? null }));
  }

  private async linkOf(
    token: string | null,
    videoId: string
  ): Promise<Result<UsedLink | null, ShareLinkExpired | DatabaseUnavailable>> {
    if (token === null) return ok(null);
    const found = await this.deps.shareLinks.findByToken(token);
    if (isErr(found)) return found;

    const used = decideShareLinkUse(found.value, { videoId, now: new Date(this.deps.now()) });
    if (isErr(used)) return used;
    return ok(
      used.value === null || found.value === null ? null : { link: found.value, grant: used.value }
    );
  }

  private async unlocked(
    video: Video,
    credential: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const { unlock, passwords, now } = this.deps;
    if (!video.passwordProtected || credential === null || unlock === null) return ok(false);

    const hash = await passwords.hashOf(video.id);
    return map(
      hash,
      (current) => current !== null && unlock.verify(video.id, current, credential, now())
    );
  }
}
