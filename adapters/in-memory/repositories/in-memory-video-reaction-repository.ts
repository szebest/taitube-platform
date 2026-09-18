import type {
  ReactionCounts,
  ReactionInputType,
  ReactionType,
  SetReactionResult,
  VideoReaction,
  VideoReactionRepositoryPort,
} from '@vp/core/repositories';
import { uuidv7 } from 'uuidv7';
import type { InMemoryVideoRepository } from './in-memory-video-repository';

export interface InMemoryVideoReactionRepositoryOptions {
  videosRepo?: InMemoryVideoRepository;
}

export class InMemoryVideoReactionRepository implements VideoReactionRepositoryPort {
  private readonly reactions = new Map<string, VideoReaction>();
  private readonly videoCounters = new Map<string, { likesCount: number; dislikesCount: number }>();
  private videosRepo?: InMemoryVideoRepository;

  constructor(options: InMemoryVideoReactionRepositoryOptions = {}) {
    this.videosRepo = options.videosRepo;
  }

  setVideosRepo(videosRepo: InMemoryVideoRepository): void {
    this.videosRepo = videosRepo;
  }

  private key(videoId: string, userId: string): string {
    return `${userId}:${videoId}`;
  }

  async getUserReaction(videoId: string, userId: string): Promise<ReactionType | null> {
    const reaction = this.reactions.get(this.key(videoId, userId));
    return reaction ? reaction.type : null;
  }

  async getReactionCounts(videoId: string): Promise<ReactionCounts> {
    const counts = this.videoCounters.get(videoId);
    if (counts) {
      return { ...counts };
    }
    return { likesCount: 0, dislikesCount: 0 };
  }

  async setReaction(
    videoId: string,
    userId: string,
    type: ReactionInputType
  ): Promise<SetReactionResult> {
    const k = this.key(videoId, userId);
    const existing = this.reactions.get(k);
    const previousType = existing ? existing.type : null;

    let deltaLikes = 0;
    let deltaDislikes = 0;

    if (type === 'NONE') {
      if (existing) {
        this.reactions.delete(k);
        if (previousType === 'LIKE') deltaLikes = -1;
        else if (previousType === 'DISLIKE') deltaDislikes = -1;
      }
    } else if (type === 'LIKE') {
      if (previousType === 'DISLIKE' && existing) {
        deltaDislikes = -1;
        deltaLikes = 1;
        this.reactions.set(k, {
          ...existing,
          type: 'LIKE',
          updatedAt: new Date(),
        });
      } else if (previousType === null) {
        deltaLikes = 1;
        this.reactions.set(k, {
          id: uuidv7(),
          videoId,
          userId,
          type: 'LIKE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } else if (type === 'DISLIKE') {
      if (previousType === 'LIKE' && existing) {
        deltaLikes = -1;
        deltaDislikes = 1;
        this.reactions.set(k, {
          ...existing,
          type: 'DISLIKE',
          updatedAt: new Date(),
        });
      } else if (previousType === null) {
        deltaDislikes = 1;
        this.reactions.set(k, {
          id: uuidv7(),
          videoId,
          userId,
          type: 'DISLIKE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const curr = this.videoCounters.get(videoId) ?? { likesCount: 0, dislikesCount: 0 };
    const likesCount = Math.max(0, curr.likesCount + deltaLikes);
    const dislikesCount = Math.max(0, curr.dislikesCount + deltaDislikes);
    this.videoCounters.set(videoId, { likesCount, dislikesCount });

    if (this.videosRepo) {
      const video = await this.videosRepo.findById(videoId);
      if (video) {
        video.likesCount = likesCount;
        video.dislikesCount = dislikesCount;
      }
    }

    return {
      previousType,
      newType: type === 'NONE' ? null : type,
      likesCount,
      dislikesCount,
    };
  }

  async countGroundTruth(videoId: string): Promise<ReactionCounts> {
    let likesCount = 0;
    let dislikesCount = 0;
    for (const r of this.reactions.values()) {
      if (r.videoId === videoId) {
        if (r.type === 'LIKE') likesCount++;
        else if (r.type === 'DISLIKE') dislikesCount++;
      }
    }
    return { likesCount, dislikesCount };
  }

  async updateVideoCounters(
    videoId: string,
    likesCount: number,
    dislikesCount: number
  ): Promise<void> {
    this.videoCounters.set(videoId, { likesCount, dislikesCount });
    if (this.videosRepo) {
      const video = await this.videosRepo.findById(videoId);
      if (video) {
        video.likesCount = likesCount;
        video.dislikesCount = dislikesCount;
      }
    }
  }

  async listVideoIdsWithReactions(limit = 100, offset = 0): Promise<string[]> {
    const ids = new Set<string>();
    for (const r of this.reactions.values()) {
      ids.add(r.videoId);
    }
    return Array.from(ids).slice(offset, offset + limit);
  }

  clear(): void {
    this.reactions.clear();
    this.videoCounters.clear();
  }
}
