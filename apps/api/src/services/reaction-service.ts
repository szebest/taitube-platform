import { CaslAuthorizationAdapter } from '@vp/adapters';
import type { ReactionCounts, ReactionInputType, ReactionType } from '@vp/domain';
import type { AuthorizationPort, ReactionCachePort } from '@vp/core/ports';
import type { VideoRepository } from '@vp/core/repositories';
import type { VideoReactionRepositoryPort } from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { canReactVideo } from '@vp/permissions';
import type { AuthUser } from '../plugins/auth';

export interface ReactionServiceDeps {
  videoReactions: VideoReactionRepositoryPort;
  reactionCache?: ReactionCachePort;
  videos: VideoRepository;
  authorization?: AuthorizationPort;
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

/**
 * ReactionService — Deep domain module for video reactions and counter caching (Ticket 40, SDD §6.1).
 */
export class ReactionService {
  private readonly videoReactions: VideoReactionRepositoryPort;
  private readonly reactionCache?: ReactionCachePort;
  private readonly videos: VideoRepository;
  private readonly auth: AuthorizationPort;

  constructor(deps: ReactionServiceDeps) {
    this.videoReactions = deps.videoReactions;
    this.reactionCache = deps.reactionCache;
    this.videos = deps.videos;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
  }

  /**
   * Sets or clears a reaction on a video for the authenticated caller.
   */
  async setReaction(
    user: AuthUser,
    videoId: string,
    type: ReactionInputType
  ): Promise<SetReactionOutput> {
    this.auth.assertCan(
      canReactVideo,
      { user: user },
      {
        action: 'react',
        subject: 'Video',
        user: user,
        message: 'Your role is not allowed to react to videos',
      }
    );

    const video = await this.videos.findById(videoId);
    if (!video) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    const result = await this.videoReactions.setReaction(videoId, user.id, type);

    if (this.reactionCache) {
      await this.reactionCache.setCounts(videoId, {
        likesCount: result.likesCount,
        dislikesCount: result.dislikesCount,
      });
      await this.reactionCache.setUserReaction(user.id, videoId, result.newType);
    }

    return {
      videoId,
      reaction: result.newType,
      likesCount: result.likesCount,
      dislikesCount: result.dislikesCount,
    };
  }

  /**
   * Retrieves the reaction for the authenticated caller on a given video.
   */
  async getUserReaction(user: AuthUser, videoId: string): Promise<GetUserReactionOutput> {
    const video = await this.videos.findById(videoId);
    if (!video) {
      throw new PermanentError(ErrorCodes.VIDEO_NOT_FOUND, `Video ${videoId} not found`);
    }

    let reaction: ReactionType | null = null;
    if (this.reactionCache) {
      reaction = await this.reactionCache.getUserReaction(user.id, videoId, () =>
        this.videoReactions.getUserReaction(videoId, user.id)
      );
    } else {
      reaction = await this.videoReactions.getUserReaction(videoId, user.id);
    }

    return {
      videoId,
      reaction,
    };
  }

  /**
   * Retrieves current cached or computed reaction counters for a video.
   */
  async getCounts(videoId: string): Promise<ReactionCounts> {
    if (this.reactionCache) {
      return await this.reactionCache.getCounts(videoId, () =>
        this.videoReactions.getReactionCounts(videoId)
      );
    }
    return await this.videoReactions.getReactionCounts(videoId);
  }
}
