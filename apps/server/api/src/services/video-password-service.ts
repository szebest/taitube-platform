import { MS_PER_SECOND } from '@kit/primitives';
import { type Result, err, isErr, ok } from '@kit/result';
import type { HashingFailed, PasswordHasherPort } from '@vp/core/ports';
import type { VideoPasswordRepository, VideoRepository } from '@vp/core/repositories';
import { VIDEO_UNLOCK_TTL_SECONDS } from '@vp/domain';
import {
  type InvalidVideoPassword,
  type VideoNotFound,
  type VideoPasswordInvalid,
  type VideoPasswordsOff,
  decideVideoPassword,
  decideVideoRead,
  videoNotFound,
  videoPasswordInvalid,
  videoPasswordsOff,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { UnlockCredentials } from './video-access-gate';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface VideoPasswordServiceDeps {
  videos: VideoRepository;
  passwords: VideoPasswordRepository;
  hasher: PasswordHasherPort;
  unlock: UnlockCredentials | null;
  now: () => number;
}

/** What the route sets as the video's cookie; never part of a response body. */
export interface VideoUnlock {
  readonly credential: string;
  readonly maxAgeSeconds: number;
}

export type SetVideoPasswordFailure =
  | EditAccessFailure
  | VideoPasswordsOff
  | InvalidVideoPassword
  | HashingFailed;
export type UnlockVideoFailure =
  | VideoNotFound
  | VideoPasswordsOff
  | VideoPasswordInvalid
  | HashingFailed
  | DatabaseUnavailable;

/**
 * A password on an unlisted video, kept as a salted scrypt hash that only this service and the
 * gate read. Neither the password nor the hash leaves here in a result.
 */
export class VideoPasswordService {
  constructor(private readonly deps: VideoPasswordServiceDeps) {}

  async set(
    user: UserContext,
    videoId: string,
    password: string
  ): Promise<Result<{ passwordProtected: true }, SetVideoPasswordFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    if (this.deps.unlock === null) return err(videoPasswordsOff());

    const decided = decideVideoPassword(password, video.value);
    if (isErr(decided)) return decided;
    const hash = await this.deps.hasher.hash(decided.value);
    if (isErr(hash)) return hash;

    const stored = await this.deps.passwords.setHash(videoId, hash.value);
    if (isErr(stored)) return stored;
    return stored.value ? ok({ passwordProtected: true }) : err(videoNotFound(videoId));
  }

  async clear(user: UserContext, videoId: string): Promise<Result<null, EditAccessFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const stored = await this.deps.passwords.setHash(videoId, null);
    if (isErr(stored)) return stored;
    return stored.value ? ok(null) : err(videoNotFound(videoId));
  }

  /** A video the caller cannot read is absent here, whatever the reason, and so is the answer. */
  async unlock(
    viewer: UserContext | null,
    videoId: string,
    password: string
  ): Promise<Result<VideoUnlock, UnlockVideoFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    if (isErr(decideVideoRead({ viewer, video: found.value, videoId }))) {
      return err(videoNotFound(videoId));
    }
    const { unlock, now } = this.deps;
    if (unlock === null) return err(videoPasswordsOff());

    const hash = await this.deps.passwords.hashOf(videoId);
    if (isErr(hash)) return hash;
    if (hash.value === null) return err(videoPasswordInvalid(videoId));
    const matches = await this.deps.hasher.verify(password, hash.value);
    if (isErr(matches)) return matches;
    if (!matches.value) return err(videoPasswordInvalid(videoId));

    const expiresAtMs = now() + VIDEO_UNLOCK_TTL_SECONDS * MS_PER_SECOND;
    return ok({
      credential: unlock.issue(videoId, hash.value, expiresAtMs),
      maxAgeSeconds: VIDEO_UNLOCK_TTL_SECONDS,
    });
  }
}
