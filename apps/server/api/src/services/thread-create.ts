import type { DatabaseUnavailable } from '@kit/errors';
import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { ThreadBody, ThreadView } from '@vp/api-contracts';
import type { CommentSlowModePort } from '@vp/core/ports';
import type {
  ChannelMemberRepositoryPort,
  VideoRepository,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import { type ActingChannel, THREADS_OPEN_PER_VIEWER } from '@vp/domain';
import {
  type AuthorizationFailure,
  type CommentGateFailure,
  type CommentsSlowMode,
  type CreateThreadFailure,
  type ThreadLimit,
  type ThreadNotFound,
  decideChannelTask,
  decideThreadCreate,
  evaluateCommentGate,
  threadLimit,
  threadNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { claimSlowMode, moderationOf, moderatorsOf } from './comment-create';
import { type CommentGateLookups, loadCommentGate } from './comment-gate-context';
import { toThreadView } from './thread-views';

export interface ThreadCreateDeps extends CommentGateLookups {
  videos: Pick<VideoRepository, 'findById'>;
  threads: Pick<VideoThreadRepositoryPort, 'countOpen' | 'create' | 'findEntry'>;
  members: Pick<ChannelMemberRepositoryPort, 'listByChannel'>;
  slowMode: CommentSlowModePort;
  now: () => number;
}

export type CreateThreadServiceFailure =
  | AuthorizationFailure
  | CreateThreadFailure
  | CommentGateFailure
  | CommentsSlowMode
  | ThreadLimit
  | ThreadNotFound
  | DatabaseUnavailable;

/** Posted as the acting channel through the gate that guards the video's comments, as one comment would be. */
export async function createThread(
  deps: ThreadCreateDeps,
  author: UserContext,
  acting: ActingChannel,
  videoId: string,
  body: ThreadBody
): Promise<Result<ThreadView, CreateThreadServiceFailure>> {
  const allowed = decideChannelTask({ user: author, acting, task: 'comment-as' });
  if (isErr(allowed)) return allowed;

  const video = await deps.videos.findById(videoId);
  if (isErr(video)) return video;
  const open = await deps.threads.countOpen(videoId, author.id);
  if (isErr(open)) return open;

  const decided = decideThreadCreate({
    author,
    video: video.value,
    videoId,
    ...body,
    openThreads: open.value,
  });
  if (isErr(decided)) return decided;
  const { title, body: text, anchorMs } = decided.value;
  const { channelId } = decided.value.video;

  const gate = await loadCommentGate(
    deps,
    author,
    acting.channelId,
    { type: 'video', video: decided.value.video },
    new Date(deps.now())
  );
  if (isErr(gate)) return gate;
  const verdict = evaluateCommentGate(gate.value.settings, gate.value.context, `${title}\n${text}`);
  if (isErr(verdict)) return verdict;

  const moderators = await moderatorsOf(deps, channelId, decided.value.video.ownerId);
  if (isErr(moderators)) return moderators;

  const claimed = await claimSlowMode(deps, channelId, author.id, verdict.value.slowModeSeconds);
  if (isErr(claimed)) return claimed;

  const release = async () => {
    if (!claimed.value) return;
    ignore(
      await deps.slowMode.release(channelId, author.id),
      'the thread was not stored; the window ends on its own TTL'
    );
  };

  const created = await deps.threads.create(
    {
      id: uuidv7(),
      videoId,
      channelId,
      authorId: author.id,
      authorChannelId: acting.channelId,
      anchorMs,
      title,
      body: text,
      moderation: moderationOf(verdict.value, `${title}\n${text}`),
      moderators: moderators.value,
    },
    THREADS_OPEN_PER_VIEWER
  );
  if (isErr(created) || created.value.type === 'limit') {
    await release();
    return isErr(created) ? created : err(threadLimit(THREADS_OPEN_PER_VIEWER));
  }

  const entry = await deps.threads.findEntry(created.value.thread.id);
  if (isErr(entry)) return entry;
  return entry.value
    ? ok(toThreadView(entry.value, decided.value.video, author))
    : err(threadNotFound(created.value.thread.id));
}
