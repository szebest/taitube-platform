import type { CommentViewer } from '@vp/core/repositories';
import type { CommentTarget } from '@vp/domain';
import { compareKeys, rowKey } from './comment-order';
import { sameTarget } from './comment-targets';
import type { StoredComment } from './comment-visibility';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';

/** The authors a channel has shadow banned, by channel. */
type ShadowedAuthors = ReadonlyMap<string, ReadonlySet<string>>;

export interface PublicScopeContext {
  readonly shadowed: ShadowedAuthors;
  readonly comments: ReadonlyMap<string, StoredComment>;
}

/** @internal The in-memory form of `ownOrPublicScope`: the public comments and the viewer's own. */
export function isOwnOrPublic(
  viewer: CommentViewer,
  comment: StoredComment,
  shadowed: ShadowedAuthors
): boolean {
  const isPublic =
    comment.moderationState === 'published' &&
    !shadowed.get(comment.channelId)?.has(comment.authorId);
  return isPublic || (viewer !== null && comment.authorId === viewer.id);
}

/** Which replies a viewer's reply count includes, once a scope is known. */
export const ownOrPublicTo =
  (viewer: CommentViewer, { shadowed }: PublicScopeContext) =>
  (reply: StoredComment) =>
    isOwnOrPublic(viewer, reply, shadowed);

/** The in-memory form of `publicCommentScope`: a reply needs a root the viewer may see too. */
export function isVisibleTo(
  viewer: CommentViewer,
  comment: StoredComment,
  { shadowed, comments }: PublicScopeContext
): boolean {
  if (!isOwnOrPublic(viewer, comment, shadowed)) return false;
  if (comment.parentId === null) return true;
  const parent = comments.get(comment.parentId);
  return parent !== undefined && isOwnOrPublic(viewer, parent, shadowed);
}

/** The author's comments on a target that only they can see, newest first. */
export function ownNonPublic(
  standing: readonly StoredComment[],
  target: CommentTarget,
  authorId: string,
  scope: PublicScopeContext
): StoredComment[] {
  const viewer = { id: authorId };
  return standing
    .filter((row) => sameTarget(row.target, target) && row.authorId === authorId)
    .filter((row) => isVisibleTo(viewer, row, scope) && !isVisibleTo(null, row, scope))
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));
}

export interface PublicScopeLookups {
  restrictions: Pick<InMemoryChannelUserRestrictionRepository, 'shadowedUserIds'>;
}

/** The shadow bans of `channelIds` and of every channel a stored comment is under. */
export function publicScopeOf(
  comments: ReadonlyMap<string, StoredComment>,
  channelIds: readonly string[],
  { restrictions }: PublicScopeLookups
): PublicScopeContext {
  const everyChannel = new Set([...channelIds, ...[...comments.values()].map((c) => c.channelId)]);
  const shadowed = new Map(
    [...everyChannel].map((channelId) => [channelId, restrictions.shadowedUserIds(channelId)])
  );
  return { shadowed, comments };
}
