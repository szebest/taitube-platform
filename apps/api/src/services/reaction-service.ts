import type { ReactionCachePort } from '@vp/core/ports';
import type {
  VideoReactionRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import type { ReactionCounts, ReactionInputType, ReactionType } from '@vp/domain';
import { type ReactFailure, decideReact } from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import { type Result, err, isErr, isOk, ok } from '@vp/result';
import type { AuthUser } from '../plugins/auth';

export interface ReactionServiceDeps {
  videoReactions: VideoReactionRepositoryPort;
  reactionCache?: ReactionCachePort;
  videos: VideoRepository;
}

export interface SetReactionOutput {
  videoId: string;
  reaction: ReactionType | null;
  likesCount: number;
  dislikesCount: number;
}

export interface GetUserReactionOutput {
  videoId: string;
  reaction: ReactionType | null;
}

export type ReactionServiceFailure = ReactFailure | DatabaseUnavailable;

/**
 * Reactions on a video. `CacheUnavailable` is absent from every signature: a dead cache costs a
 * query, not an answer, so this service narrows it away and the repository remains the authority.
 */
export class ReactionService {
  private readonly videoReactions: VideoReactionRepositoryPort;
  private readonly reactionCache?: ReactionCachePort;
  private readonly videos: VideoRepository;

  constructor(deps: ReactionServiceDeps) {
    this.videoReactions = deps.videoReactions;
    this.reactionCache = deps.reactionCache;
    this.videos = deps.videos;
  }

  private async reactableVideo(
    user: AuthUser | null,
    videoId: string
  ): Promise<Result<unknown, ReactionServiceFailure>> {
    const found = await this.videos.findById(videoId);
    if (isErr(found)) return found;

    return decideReact({ reactor: user, video: found.value, videoId });
  }

  async setReaction(
    user: AuthUser,
    videoId: string,
    type: ReactionInputType
  ): Promise<Result<SetReactionOutput, ReactionServiceFailure>> {
    const allowed = await this.reactableVideo(user, videoId);
    if (isErr(allowed)) return allowed;

    const written = await this.videoReactions.setReaction(videoId, user.id, type);
    if (isErr(written)) return written;

    const { newType, likesCount, dislikesCount } = written.value;
    await this.reactionCache?.setCounts(videoId, { likesCount, dislikesCount });
    await this.reactionCache?.setUserReaction(user.id, videoId, newType);

    return ok({ videoId, reaction: newType, likesCount, dislikesCount });
  }

  async getUserReaction(
    user: AuthUser,
    videoId: string
  ): Promise<Result<GetUserReactionOutput, ReactionServiceFailure>> {
    const allowed = await this.reactableVideo(user, videoId);
    if (isErr(allowed)) return allowed;

    const reaction = this.reactionCache
      ? await this.reactionCache.getUserReaction(user.id, videoId, () =>
          this.videoReactions.getUserReaction(videoId, user.id)
        )
      : await this.videoReactions.getUserReaction(videoId, user.id);

    if (isOk(reaction)) return ok({ videoId, reaction: reaction.value });
    if (reaction.error.code !== ErrorCodes.CACHE_UNAVAILABLE) return err(reaction.error);

    const direct = await this.videoReactions.getUserReaction(videoId, user.id);
    return isErr(direct) ? direct : ok({ videoId, reaction: direct.value });
  }

  async getCounts(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>> {
    const fetch = () => this.videoReactions.getReactionCounts(videoId);
    if (!this.reactionCache) return await fetch();

    const cached = await this.reactionCache.getCounts(videoId, fetch);
    if (isOk(cached)) return cached;
    if (cached.error.code === ErrorCodes.CACHE_UNAVAILABLE) return await fetch();
    return err(cached.error);
  }
}
