import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { RemoveThreadBody, ThreadView } from '@vp/api-contracts';
import type { CommentCachePort } from '@vp/core/ports';
import type {
  CommentSettingsRepositoryPort,
  VideoRepository,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import {
  COMMENT_REMOVAL_EXCERPT_LENGTH,
  type ModerationNotice,
  type NewChannelAuditEntry,
  THREADS_PINNED_LIMIT,
  type Video,
  type VideoThread,
  commentModerationAudit,
} from '@vp/domain';
import {
  type ManageThreadFailure,
  type ModerationNotApplicable,
  type ThreadNotFound,
  type ThreadPinLimit,
  applyModeration,
  decideThreadPin,
  decideThreadRemove,
  threadNotFound,
  threadPinLimit,
} from '@vp/domain-rules';
import { type UserContext, canModerateComment } from '@vp/permissions';
import { auditActor } from './audit-actor';
import { toThreadView } from './thread-views';

export interface ThreadManageDeps {
  videos: Pick<VideoRepository, 'findById'>;
  threads: VideoThreadRepositoryPort;
  settings: Pick<CommentSettingsRepositoryPort, 'get'>;
  commentCache: CommentCachePort;
}

export type PinThreadServiceFailure =
  | ManageThreadFailure
  | ThreadPinLimit
  | ThreadNotFound
  | DatabaseUnavailable;

export type RemoveThreadServiceFailure =
  | ManageThreadFailure
  | ModerationNotApplicable
  | ThreadNotFound
  | DatabaseUnavailable;

export async function threadAndVideo(
  deps: Pick<ThreadManageDeps, 'videos' | 'threads'>,
  threadId: string
): Promise<Result<{ thread: VideoThread | null; video: Video | null }, DatabaseUnavailable>> {
  const thread = await deps.threads.findById(threadId);
  if (isErr(thread)) return thread;
  const video = thread.value ? await deps.videos.findById(thread.value.videoId) : ok(null);
  return isErr(video) ? video : ok({ thread: thread.value, video: video.value });
}

function pinAudit(
  actor: UserContext,
  thread: VideoThread,
  video: Video,
  pinned: boolean
): NewChannelAuditEntry {
  return {
    channelId: video.channelId,
    ...auditActor(actor),
    action: 'comment.pinned',
    targetType: 'comment',
    targetId: thread.id,
    meta: { videoId: video.id, pinned },
  };
}

export async function setThreadPinned(
  deps: ThreadManageDeps,
  actor: UserContext | null,
  threadId: string,
  pinned: boolean
): Promise<Result<ThreadView, PinThreadServiceFailure>> {
  const found = await threadAndVideo(deps, threadId);
  if (isErr(found)) return found;
  const decided = decideThreadPin({ actor, threadId, ...found.value });
  if (isErr(decided)) return decided;
  const { thread, video, actor: pinner } = decided.value;

  const outcome = await deps.threads.setPinned(
    thread.id,
    pinned,
    THREADS_PINNED_LIMIT,
    pinAudit(pinner, thread, video, pinned)
  );
  if (isErr(outcome)) return outcome;
  if (outcome.value === 'limit') return err(threadPinLimit(THREADS_PINNED_LIMIT));
  if (outcome.value === 'missing') return err(threadNotFound(threadId));

  const entry = await deps.threads.findEntry(thread.id);
  if (isErr(entry)) return entry;
  return entry.value ? ok(toThreadView(entry.value, video, pinner)) : err(threadNotFound(threadId));
}

export async function removeThread(
  deps: ThreadManageDeps,
  actor: UserContext | null,
  threadId: string,
  body: RemoveThreadBody
): Promise<Result<void, RemoveThreadServiceFailure>> {
  const found = await threadAndVideo(deps, threadId);
  if (isErr(found)) return found;
  const decided = decideThreadRemove({ actor, threadId, ...found.value });
  if (isErr(decided)) return decided;
  const { thread, video, actor: remover } = decided.value;

  const moderates = canModerateComment({
    user: remover,
    action: 'remove',
    videoOwnerId: video.ownerId,
    videoChannelId: video.channelId,
  });
  const settings = await deps.settings.get(video.channelId);
  if (isErr(settings)) return settings;
  const outcome = moderates
    ? applyModeration(thread.moderationState, {
        action: 'remove',
        disclosure: body.disclosure ?? settings.value.disclosure.remove,
        ...(body.reason && { reason: body.reason }),
        ...(body.note && { note: body.note }),
      })
    : ok({ state: 'removed' as const, disclosure: 'silent' as const, reason: null, note: null });
  if (isErr(outcome)) return outcome;
  const { disclosure, reason, note } = outcome.value;

  const visible = disclosure === 'visible' && thread.authorId !== remover.id;
  const notice: ModerationNotice | undefined = visible
    ? {
        userId: thread.authorId,
        action: 'remove',
        channelId: video.channelId,
        videoId: video.id,
        commentId: null,
        reason,
        expiresAt: null,
        excerpt: thread.title.slice(0, COMMENT_REMOVAL_EXCERPT_LENGTH),
      }
    : undefined;

  const removed = await deps.threads.remove(thread.id, {
    audit: commentModerationAudit({
      channelId: video.channelId,
      ...auditActor(remover),
      action: 'remove',
      commentId: thread.id,
      videoId: video.id,
      disclosure: disclosure ?? 'silent',
    }),
    ...(notice && { notice }),
    ...(visible && {
      removal: {
        id: thread.id,
        channelId: video.channelId,
        videoId: video.id,
        authorId: thread.authorId,
        excerpt: thread.title.slice(0, COMMENT_REMOVAL_EXCERPT_LENGTH),
        reason: reason ?? 'other',
        note,
        disclosure: 'visible' as const,
        removedBy: remover.id,
      },
    }),
  });
  if (isErr(removed)) return removed;
  if (!removed.value) return err(threadNotFound(threadId));

  ignore(
    await deps.commentCache.invalidate({ type: 'thread', id: thread.id }),
    'the thread is gone; its hot page expires on its own TTL'
  );
  return ok();
}
