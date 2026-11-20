import { ok, type Result } from '@kit/result';
import { VideoPasswordRepository } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';

/** The video records whose `passwordProtected` follows the hash held here. */
export interface PasswordGuardedVideos {
  setPasswordProtected(videoId: string, passwordProtected: boolean): boolean;
}

export class InMemoryVideoPasswordRepository extends VideoPasswordRepository {
  private readonly hashes = new Map<string, string>();

  constructor(private readonly videos: PasswordGuardedVideos) {
    super();
  }

  async hashOf(videoId: string): Promise<Result<string | null, DatabaseUnavailable>> {
    return ok(this.hashes.get(videoId) ?? null);
  }

  async setHash(
    videoId: string,
    hash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.videos.setPasswordProtected(videoId, hash !== null)) return ok(false);
    if (hash === null) this.hashes.delete(videoId);
    else this.hashes.set(videoId, hash);
    return ok(true);
  }

  clear(): void {
    this.hashes.clear();
  }
}
