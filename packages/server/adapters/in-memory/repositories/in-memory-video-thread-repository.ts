import { type Result, isErr, ok, unwrapOr } from '@kit/result';
import type {
  ListHeldThreadsOptions,
  ListVideoThreadsOptions,
  ThreadModerated,
  ThreadModerationWrite,
  ThreadRemovalRecord,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import type { OutboxRepository, UserEventRepository } from '@vp/core/repositories';
import {
  type CommentRemoval,
  type CommentTarget,
  type NewChannelAuditEntry,
  type NewVideoThreadInput,
  type ThreadCreated,
  type ThreadPinOutcome,
  type VideoThread,
  type VideoThreadEntry,
  commentHeld,
  keepsPin,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { recordModeration } from './comment-moderation-record';
import type { StoredComment } from './comment-visibility';
import { standing } from './comment-visibility';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';

export interface InMemoryVideoThreadRepositoryOptions {
  auditRepo: Pick<InMemoryChannelAuditRepository, 'append'>;
  outboxRepo: Pick<OutboxRepository, 'enqueue'>;
  userEventsRepo: Pick<UserEventRepository, 'append'>;
  channelsRepo: Pick<InMemoryChannelRepository, 'findById'>;
  restrictionsRepo: Pick<
    InMemoryChannelUserRestrictionRepository,
    'restrictedUserIds' | 'shadowedUserIds'
  >;
  commentsRepo: {
    readonly comments: ReadonlyMap<string, StoredComment>;
    readonly removals: Map<string, CommentRemoval>;
  };
  /** The in-memory form of the trigger that deletes a target's comments with it. */
  removeComments: (target: CommentTarget) => void;
}

export class InMemoryVideoThreadRepository implements VideoThreadRepositoryPort {
  /** Read by the comment repositories, which move a thread's `commentsCount`. */
  readonly threads = new Map<string, VideoThread>();

  constructor(private readonly deps: InMemoryVideoThreadRepositoryOptions) {}

  async findById(id: string): Promise<Result<VideoThread | null, DatabaseUnavailable>> {
    const thread = this.threads.get(id);
    return ok(thread ? { ...thread } : null);
  }

  async findEntry(id: string): Promise<Result<VideoThreadEntry | null, DatabaseUnavailable>> {
    const thread = this.threads.get(id);
    return ok(thread ? await this.entryOf(thread) : null);
  }

  async listByVideo(
    videoId: string,
    { viewer, limit }: ListVideoThreadsOptions
  ): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>> {
    const visible = [...this.threads.values()]
      .filter((thread) => thread.videoId === videoId)
      .filter(
        (thread) =>
          (viewer && thread.authorId === viewer.id) ||
          (thread.moderationState === 'published' &&
            !this.deps.restrictionsRepo.shadowedUserIds(thread.channelId).has(thread.authorId))
      )
      .sort(
        (a, b) =>
          (b.pinnedAt?.getTime() ?? -Infinity) - (a.pinnedAt?.getTime() ?? -Infinity) ||
          a.anchorMs - b.anchorMs ||
          a.id.localeCompare(b.id)
      )
      .slice(0, limit);

    return ok(await Promise.all(visible.map((thread) => this.entryOf(thread))));
  }

  async listHeld({
    channelId,
    authorId,
    cursor,
    limit,
  }: ListHeldThreadsOptions): Promise<Result<VideoThreadEntry[], DatabaseUnavailable>> {
    const held = [...this.threads.values()]
      .filter((thread) => thread.channelId === channelId && thread.moderationState === 'held')
      .filter((thread) => authorId === undefined || thread.authorId === authorId)
      .filter(
        (thread) =>
          !cursor ||
          thread.createdAt < cursor.createdAt ||
          (thread.createdAt.getTime() === cursor.createdAt.getTime() && thread.id < cursor.id)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
      .slice(0, limit);

    return ok(await Promise.all(held.map((thread) => this.entryOf(thread))));
  }

  async moderate({
    id,
    from,
    outcome,
    audit,
    notice,
  }: ThreadModerationWrite): Promise<Result<ThreadModerated, DatabaseUnavailable>> {
    const thread = this.threads.get(id);
    if (!thread) return ok({ type: 'missing' });
    if (thread.moderationState !== from)
      return ok({ type: 'stale', state: thread.moderationState });

    thread.moderationState = outcome.state;
    thread.moderationDisclosure = outcome.disclosure;
    thread.heldReason = null;
    if (!keepsPin(outcome.state)) thread.pinnedAt = null;
    const recorded = await recordModeration(this.deps, { audit, ...(notice && { notice }) });
    return isErr(recorded) ? recorded : ok({ type: 'applied', thread: { ...thread } });
  }

  async countOpen(videoId: string, authorId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.open(videoId, authorId));
  }

  async create(
    input: NewVideoThreadInput,
    openLimit: number
  ): Promise<Result<ThreadCreated, DatabaseUnavailable>> {
    if (this.open(input.videoId, input.authorId) >= openLimit) return ok({ type: 'limit' });
    const { moderation, moderators = [], ...fields } = input;
    const thread: VideoThread = {
      ...fields,
      moderationState: moderation.moderationState,
      moderationDisclosure: moderation.moderationDisclosure,
      heldReason: moderation.heldReason,
      pinnedAt: null,
      commentsCount: 0,
      createdAt: new Date(),
    };
    this.threads.set(thread.id, thread);
    if (thread.moderationState === 'held') {
      const held = commentHeld({ id: thread.id, target: { type: 'thread', id: thread.id } });
      for (const userId of moderators.filter((id) => id !== thread.authorId)) {
        const told = await this.deps.userEventsRepo.append({ userId, ...held });
        if (isErr(told)) return told;
      }
    }
    return ok({ type: 'created', thread: { ...thread } });
  }

  async setPinned(
    id: string,
    pinned: boolean,
    limit: number,
    audit: NewChannelAuditEntry
  ): Promise<Result<ThreadPinOutcome, DatabaseUnavailable>> {
    const thread = this.threads.get(id);
    if (!thread) return ok('missing');
    if (pinned === (thread.pinnedAt !== null)) return ok(pinned ? 'pinned' : 'unpinned');
    if (pinned) {
      const held = [...this.threads.values()].filter(
        (other) => other.videoId === thread.videoId && other.pinnedAt !== null
      ).length;
      if (held >= limit) return ok('limit');
    }
    thread.pinnedAt = pinned ? new Date() : null;
    const audited = await this.deps.auditRepo.append(audit);
    return isErr(audited) ? audited : ok(pinned ? 'pinned' : 'unpinned');
  }

  async remove(
    id: string,
    record: ThreadRemovalRecord
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.threads.delete(id)) return ok(false);
    this.deps.removeComments({ type: 'thread', id });
    if (record.removal) {
      this.deps.commentsRepo.removals.set(record.removal.id, {
        ...record.removal,
        createdAt: new Date(),
      });
    }
    const recorded = await recordModeration(this.deps, {
      audit: record.audit,
      ...(record.notice && { notice: record.notice }),
    });
    return isErr(recorded) ? recorded : ok(true);
  }

  clear(): void {
    this.threads.clear();
  }

  private async entryOf(thread: VideoThread): Promise<VideoThreadEntry> {
    const channel = unwrapOr(await this.deps.channelsRepo.findById(thread.authorChannelId), null);
    const counted = this.countedReplies(thread);
    return {
      thread: { ...thread },
      author: {
        channelId: thread.authorChannelId,
        handle: channel?.handle ?? null,
        displayName: channel?.displayName ?? null,
        avatarUrl: channel?.avatarUrl ?? null,
      },
      replyCount: thread.commentsCount,
      markerReplies: counted.length,
      markerRepliers: new Set(counted.map((reply) => reply.authorId)).size,
      authorShadowed: this.deps.restrictionsRepo
        .shadowedUserIds(thread.channelId)
        .has(thread.authorId),
    };
  }

  private open(videoId: string, authorId: string): number {
    return [...this.threads.values()].filter(
      (thread) => thread.videoId === videoId && thread.authorId === authorId
    ).length;
  }

  private countedReplies(thread: VideoThread): StoredComment[] {
    const restricted = this.deps.restrictionsRepo.restrictedUserIds(thread.channelId);
    return standing(this.deps.commentsRepo.comments.values()).filter(
      (comment) =>
        comment.target.type === 'thread' &&
        comment.target.id === thread.id &&
        comment.moderationState === 'published' &&
        !restricted.has(comment.authorId)
    );
  }
}
