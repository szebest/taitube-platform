import type { CommentViewer, VideoRepository } from '@vp/core/repositories';
import { unwrapOr } from '@vp/result';
import { compareKeys, rowKey } from './comment-order';
import type { StoredComment } from './comment-visibility';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryChannelUserRestrictionRepository } from './in-memory-channel-user-restriction-repository';

/** The authors a channel has shadow banned, by the video their comments sit under. */
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
    !shadowed.get(comment.videoId)?.has(comment.authorId);
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

/** The author's comments on a video that only they can see, newest first. */
export function ownNonPublic(
  standing: readonly StoredComment[],
  videoId: string,
  authorId: string,
  scope: PublicScopeContext
): StoredComment[] {
  const viewer = { id: authorId };
  return standing
    .filter((row) => row.videoId === videoId && row.authorId === authorId)
    .filter((row) => isVisibleTo(viewer, row, scope) && !isVisibleTo(null, row, scope))
    .sort((a, b) => compareKeys(rowKey(b), rowKey(a)));
}

export interface PublicScopeLookups {
  videos: Pick<VideoRepository, 'findById'>;
  channels: Pick<InMemoryChannelRepository, 'findByUserId'>;
  restrictions: Pick<InMemoryChannelUserRestrictionRepository, 'shadowedUserIds'>;
}

/** The shadow bans of the channels that own `videoIds` and every video a stored comment is under. */
export async function publicScopeOf(
  comments: ReadonlyMap<string, StoredComment>,
  videoIds: readonly string[],
  { videos, channels, restrictions }: PublicScopeLookups
): Promise<PublicScopeContext> {
  const shadowed = new Map<string, Set<string>>();
  const everyVideo = new Set([...videoIds, ...[...comments.values()].map((c) => c.videoId)]);
  for (const videoId of everyVideo) {
    const video = unwrapOr(await videos.findById(videoId), null);
    const channel = video && unwrapOr(await channels.findByUserId(video.ownerId), null);
    shadowed.set(videoId, channel ? restrictions.shadowedUserIds(channel.id) : new Set());
  }
  return { shadowed, comments };
}
