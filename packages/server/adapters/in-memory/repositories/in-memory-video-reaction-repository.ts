import { reactionDelta } from '@vp/domain';
import type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
  VideoReaction,
} from '@vp/domain';
import type { VideoReactionRepositoryPort, VideoRepository } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';

export interface InMemoryVideoReactionRepositoryOptions {
  videosRepo?: VideoRepository;
}

export class InMemoryVideoReactionRepository implements VideoReactionRepositoryPort {
  private readonly reactions = new Map<string, VideoReaction>();
  private readonly videoCounters = new Map<string, { likesCount: number; dislikesCount: number }>();
  private videosRepo?: VideoRepository;

  constructor(options: InMemoryVideoReactionRepositoryOptions = {}) {
    this.videosRepo = options.videosRepo;
  }

  setVideosRepo(videosRepo: VideoRepository): void {
    this.videosRepo = videosRepo;
  }

  private key(videoId: string, userId: string): string {
    return `${userId}:${videoId}`;
  }

  async getUserReaction(
    videoId: string,
    userId: string
  ): Promise<Result<ReactionType | null, DatabaseUnavailable>> {
    const reaction = this.reactions.get(this.key(videoId, userId));
    return ok(reaction ? reaction.type : null);
  }

  async getReactionCounts(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>> {
    const counts = this.videoCounters.get(videoId);
    return ok(counts ? { ...counts } : { likesCount: 0, dislikesCount: 0 });
  }

  async setReaction(
    videoId: string,
    userId: string,
    type: ReactionInputType
  ): Promise<Result<SetReactionResult, DatabaseUnavailable>> {
    const k = this.key(videoId, userId);
    const existing = this.reactions.get(k);
    const previousType = existing ? existing.type : null;
    const newType: ReactionType | null = type === 'NONE' ? null : type;

    if (newType === null) {
      this.reactions.delete(k);
    } else if (existing) {
      this.reactions.set(k, { ...existing, type: newType, updatedAt: new Date() });
    } else {
      this.reactions.set(k, {
        id: uuidv7(),
        videoId,
        userId,
        type: newType,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const delta = reactionDelta(previousType, newType);
    const curr = this.videoCounters.get(videoId) ?? { likesCount: 0, dislikesCount: 0 };
    const likesCount = Math.max(0, curr.likesCount + delta.likes);
    const dislikesCount = Math.max(0, curr.dislikesCount + delta.dislikes);
    this.videoCounters.set(videoId, { likesCount, dislikesCount });

    if (this.videosRepo) {
      await this.videosRepo.updateReactionCounters(videoId, likesCount, dislikesCount);
    }

    return ok({
      previousType,
      newType,
      likesCount,
      dislikesCount,
    });
  }

  async countGroundTruth(videoId: string): Promise<Result<ReactionCounts, DatabaseUnavailable>> {
    let likesCount = 0;
    let dislikesCount = 0;
    for (const r of this.reactions.values()) {
      if (r.videoId === videoId) {
        if (r.type === 'LIKE') likesCount++;
        else if (r.type === 'DISLIKE') dislikesCount++;
      }
    }
    return ok({ likesCount, dislikesCount });
  }

  async updateVideoCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<Result<void, DatabaseUnavailable>> {
    this.videoCounters.set(videoId, { likesCount, dislikesCount });
    if (this.videosRepo) {
      await this.videosRepo.updateReactionCounters(videoId, likesCount, dislikesCount);
    }
    return ok();
  }

  async listVideoIdsWithReactions(
    limit = 100,
    offset = 0
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const ids = new Set<string>();
    for (const r of this.reactions.values()) {
      ids.add(r.videoId);
    }
    return ok(Array.from(ids).slice(offset, offset + limit));
  }

  clear(): void {
    this.reactions.clear();
    this.videoCounters.clear();
  }
}
