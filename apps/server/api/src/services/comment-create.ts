import { type Result, err, ignore, isErr, ok } from '@kit/result';
import type { CommentView } from '@vp/api-contracts';
import type { CommentSlowModePort } from '@vp/core/ports';
import type { ChannelMemberRepositoryPort, CommentRepositoryPort } from '@vp/core/repositories';
import {
  type ActingChannel,
  type CommentHost,
  type CommentTarget,
  type CommentThread,
  type NewCommentModeration,
  PUBLISHED_AT_CREATION,
  commentVideoId,
  roleHas,
} from '@vp/domain';
import {
  type AuthorizationFailure,
  type CommentGateFailure,
  type CommentGateVerdict,
  type CommentNotFound,
  type CommentsSlowMode,
  type CreateCommentFailure,
  type PublicHostReadFailure,
  commentHostTarget,
  commentHostTraits,
  commentNotFound,
  commentsSlowMode,
  decideChannelTask,
  decideCommentCreate,
  evaluateCommentGate,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { looksLikeQuestion } from '@vp/validation';
import { uuidv7 } from 'uuidv7';
import { auditActor } from './audit-actor';
import { type CommentGateLookups, loadCommentGate } from './comment-gate-context';
import { type CommentLookupDeps, readableHost } from './comment-lookup';
import { toCommentView } from './comment-views';

export interface CommentCreateDeps extends CommentLookupDeps, CommentGateLookups {
  comments: CommentRepositoryPort;
  members: Pick<ChannelMemberRepositoryPort, 'listByChannel'>;
  slowMode: CommentSlowModePort;
  now: () => number;
}

export type CreateCommentServiceFailure =
  | AuthorizationFailure
  | CreateCommentFailure
  | CommentGateFailure
  | CommentsSlowMode
  | PublicHostReadFailure
  | DatabaseUnavailable;

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
  acting: ActingChannel;
  host: CommentHost;
  parentId: string | null;
  content: string;
  verdict: CommentGateVerdict;
}

async function store(
  deps: CommentCreateDeps,
  { author, acting, host, parentId, content, verdict }: Pending
): Promise<Result<CommentThread, DatabaseUnavailable | CommentNotFound>> {
  const held = verdict.decision === 'hold';
  const { channelId, ownerId } = commentHostTraits(host);
  const target = commentHostTarget(host);
  const moderators = held ? await moderatorsOf(deps, channelId, ownerId) : ok([]);
  if (isErr(moderators)) return moderators;

  const id = uuidv7();
  const created = await deps.comments.create(
    {
      id,
      target,
      channelId,
      authorId: author.id,
      authorChannelId: acting.channelId,
      parentId,
      content,
      moderation: moderationOf(verdict, content),
      moderators: moderators.value,
    },
    {
      channelId: acting.channelId,
      ...auditActor(author),
      action: 'comment.posted',
      targetType: 'comment',
      targetId: id,
      meta: { videoId: commentVideoId(target) },
    }
  );
  if (isErr(created)) return created;
  return created.value ? ok(created.value) : err(commentNotFound(parentId ?? target.id));
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

/** Posted as the acting channel, which the author must be able to act as. */
export async function createComment(
  deps: CommentCreateDeps,
  author: UserContext,
  acting: ActingChannel,
  target: CommentTarget,
  body: { content: string; parentId?: string }
): Promise<Result<CommentView, CreateCommentServiceFailure>> {
  const allowed = decideChannelTask({ user: author, acting, task: 'comment-as' });
  if (isErr(allowed)) return allowed;
  const host = await readableHost(deps, author, target);
  if (isErr(host)) return host;
  const parentId = body.parentId ?? null;
  const parent = parentId ? await deps.comments.findVisible(author, parentId) : ok(null);
  if (isErr(parent)) return parent;

  const decided = decideCommentCreate({
    author,
    host: host.value,
    target,
    parent: parent.value,
    parentId,
    content: body.content,
  });
  if (isErr(decided)) return decided;
  const { content } = decided.value;
  const traits = commentHostTraits(decided.value.host);
  const { channelId } = traits;

  const now = new Date(deps.now());
  const gate = await loadCommentGate(deps, author, acting.channelId, decided.value.host, now);
  if (isErr(gate)) return gate;
  const verdict = evaluateCommentGate(gate.value.settings, gate.value.context, content);
  if (isErr(verdict)) return verdict;

  const claimed = await claimSlowMode(deps, channelId, author.id, verdict.value.slowModeSeconds);
  if (isErr(claimed)) return claimed;

  const stored = await store(deps, {
    author,
    acting,
    host: decided.value.host,
    parentId: decided.value.parentId,
    content,
    verdict: verdict.value,
  });
  if (isErr(stored)) {
    if (claimed.value) {
      ignore(
        await deps.slowMode.release(channelId, author.id),
        'the comment was not stored; the window ends on its own TTL'
      );
    }
    return stored;
  }

  return ok(toCommentView(stored.value, traits, author));
}
