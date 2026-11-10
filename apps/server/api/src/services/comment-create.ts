import type { CommentView } from '@vp/api-contracts';
import type { CommentSlowModePort } from '@vp/core/ports';
import type { ChannelMemberRepositoryPort, CommentRepositoryPort } from '@vp/core/repositories';
import {
  type CommentThread,
  type NewCommentModeration,
  PUBLISHED_AT_CREATION,
  type Video,
  roleHas,
} from '@vp/domain';
import {
  type CommentGateFailure,
  type CommentGateVerdict,
  type CommentNotFound,
  type CommentsSlowMode,
  type CreateCommentFailure,
  commentNotFound,
  commentsSlowMode,
  decideCommentCreate,
  evaluateCommentGate,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ignore, isErr, ok } from '@vp/result';
import { looksLikeQuestion } from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { type CommentGateLookups, loadCommentGate } from './comment-gate-context';
import { type CommentLookupDeps, type PublicReadFailure, readableVideo } from './comment-lookup';
import { toCommentView } from './comment-views';

export interface CommentCreateDeps extends CommentLookupDeps, CommentGateLookups {
  comments: CommentRepositoryPort;
  members: Pick<ChannelMemberRepositoryPort, 'listByChannel'>;
  slowMode: CommentSlowModePort;
  now: () => number;
}

export type CreateCommentServiceFailure =
  | CreateCommentFailure
  | CommentGateFailure
  | CommentsSlowMode
  | PublicReadFailure
  | DatabaseUnavailable;

const UNGATED: CommentGateVerdict = {
  decision: 'publish',
  heldReason: null,
  disclosure: null,
  slowModeSeconds: null,
};

function moderationOf(verdict: CommentGateVerdict, content: string): NewCommentModeration {
  return {
    ...PUBLISHED_AT_CREATION,
    moderationState: verdict.decision === 'hold' ? 'held' : 'published',
    moderationDisclosure: verdict.disclosure,
    heldReason: verdict.heldReason,
    looksLikeQuestion: looksLikeQuestion(content),
  };
}

/** A dead cache costs the limit for one comment, never the comment. */
async function claimSlowMode(
  deps: Pick<CommentCreateDeps, 'slowMode'>,
  channelId: string,
  authorId: string,
  windowSeconds: number | null
): Promise<Result<boolean, CommentsSlowMode>> {
  if (windowSeconds === null) return ok(false);
  const claim = await deps.slowMode.claim(channelId, authorId, windowSeconds);
  if (isErr(claim)) return ok(false);
  return claim.value.type === 'claimed'
    ? ok(true)
    : err(commentsSlowMode(claim.value.retryAfterSeconds));
}

interface Pending {
  author: UserContext;
  video: Video;
  parentId: string | null;
  content: string;
  channelId: string | null;
  verdict: CommentGateVerdict;
}

async function store(
  deps: CommentCreateDeps,
  { author, video, parentId, content, channelId, verdict }: Pending
): Promise<Result<CommentThread, DatabaseUnavailable | CommentNotFound>> {
  const held = channelId !== null && verdict.decision === 'hold';
  const moderators = held ? await moderatorsOf(deps, channelId, video.ownerId) : ok([]);
  if (isErr(moderators)) return moderators;

  const created = await deps.comments.create({
    id: uuidv7(),
    videoId: video.id,
    authorId: author.id,
    parentId,
    content,
    moderation: moderationOf(verdict, content),
    moderators: moderators.value,
  });
  if (isErr(created)) return created;
  return created.value ? ok(created.value) : err(commentNotFound(parentId ?? video.id));
}

export async function moderatorsOf(
  deps: Pick<CommentCreateDeps, 'members'>,
  channelId: string,
  ownerId: string
): Promise<Result<string[], DatabaseUnavailable>> {
  const members = await deps.members.listByChannel(channelId);
  if (isErr(members)) return members;
  const moderators = members.value
    .filter(({ role }) => roleHas(role, 'comment.moderate'))
    .map(({ userId }) => userId);
  return ok([ownerId, ...moderators]);
}

export async function createComment(
  deps: CommentCreateDeps,
  author: UserContext,
  videoId: string,
  body: { content: string; parentId?: string }
): Promise<Result<CommentView, CreateCommentServiceFailure>> {
  const video = await readableVideo(deps, author, videoId);
  if (isErr(video)) return video;
  const parentId = body.parentId ?? null;
  const parent = parentId ? await deps.comments.findVisible(author, parentId) : ok(null);
  if (isErr(parent)) return parent;

  const decided = decideCommentCreate({
    author,
    video: video.value,
    videoId,
    parent: parent.value,
    parentId,
    content: body.content,
  });
  if (isErr(decided)) return decided;
  const { content, video: target } = decided.value;

  const gate = await loadCommentGate(deps, author, target, new Date(deps.now()));
  if (isErr(gate)) return gate;
  const verdict = gate.value
    ? evaluateCommentGate(gate.value.settings, gate.value.context, content)
    : ok(UNGATED);
  if (isErr(verdict)) return verdict;

  const channelId = gate.value?.channelId ?? null;
  const claimed =
    channelId === null
      ? ok(false)
      : await claimSlowMode(deps, channelId, author.id, verdict.value.slowModeSeconds);
  if (isErr(claimed)) return claimed;

  const stored = await store(deps, {
    author,
    video: target,
    parentId: decided.value.parentId,
    content,
    channelId,
    verdict: verdict.value,
  });
  if (isErr(stored)) {
    if (claimed.value && channelId !== null) {
      ignore(
        await deps.slowMode.release(channelId, author.id),
        'the comment was not stored; the window ends on its own TTL'
      );
    }
    return stored;
  }

  return ok(toCommentView(stored.value, target.ownerId, author));
}
