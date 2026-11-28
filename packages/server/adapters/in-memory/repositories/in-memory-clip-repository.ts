import { ok, type Result } from '@kit/result';
import type { ClipRepositoryPort, ListClipsOptions } from '@vp/core/repositories';
import type { Clip, ClipEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { byKeysetDesc, isKeysetBefore } from './keyset';
import { keepWatchable, type VideoLookups } from './watchable-video';

const keysetOf = ({ createdAt, id }: Clip) => ({ sort: createdAt, tie: id });

export class InMemoryClipRepository implements ClipRepositoryPort {
  private readonly rows = new Map<string, Clip>();

  constructor(private readonly lookups: VideoLookups) {}

  async create(clip: Clip): Promise<Result<void, DatabaseUnavailable>> {
    this.rows.set(clip.id, { ...clip });
    return ok();
  }

  async findById(id: string): Promise<Result<Clip | null, DatabaseUnavailable>> {
    const found = this.rows.get(id);
    return ok(found ? { ...found } : null);
  }

  async listByCreator(
    viewer: UserContext,
    { cursor, limit }: ListClipsOptions
  ): Promise<Result<ClipEntry[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    const newestFirst = [...this.rows.values()]
      .filter((clip) => clip.userId === viewer.id)
      .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
      .filter((clip) => isKeysetBefore(keysetOf(clip), after));

    const kept = await keepWatchable(this.lookups, viewer, newestFirst, limit);
    return ok(kept.map(({ video, channel, ...clip }) => ({ clip: { ...clip }, video, channel })));
  }

  async listOwnByVideos(
    userId: string,
    videoIds: readonly string[]
  ): Promise<Result<Clip[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter((clip) => clip.userId === userId && videoIds.includes(clip.videoId))
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .map((clip) => ({ ...clip }))
    );
  }

  async remove(id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.rows.delete(id));
  }

  clear(): void {
    this.rows.clear();
  }
}
