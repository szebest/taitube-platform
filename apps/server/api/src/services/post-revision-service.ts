import type { DatabaseUnavailable } from '@kit/errors';
import type { InvalidCursor, Paginator } from '@kit/pagination';
import { type Result, andThen, err, isErr, ok } from '@kit/result';
import type { ManagedPostView, PostRevisionPageView, PostRevisionView } from '@vp/api-contracts';
import type { ChannelPostRepositoryPort, EntityRevisionRepository } from '@vp/core/repositories';
import { ENTITY_REVISION_KEEP, type ActingChannel, type EntityRevision } from '@vp/domain';
import {
  type AuthorizationFailure,
  type PostNotFound,
  type PostRevisionNotFound,
  decidePostTarget,
  decidePostWrite,
  postRevisionNotFound,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { isoOf } from './cursor';
import type { EditPostServiceFailure } from './post-edit';
import type { PostService } from './post-service';
import { decodeRevisionCursor, revisionCursorPayload } from './revision-cursor';

export interface PostRevisionServiceDeps {
  posts: ChannelPostRepositoryPort;
  revisions: EntityRevisionRepository;
  editor: Pick<PostService, 'edit'>;
  paginator: Paginator;
}

type HistoryFailure = AuthorizationFailure | PostNotFound | DatabaseUnavailable;

function toView(revision: EntityRevision<'channel_post'>): PostRevisionView {
  const { id, version, snapshot, authorUserId, restoredFromVersion, createdAt } = revision;
  return {
    id,
    version,
    payload: snapshot.payload,
    authorUserId,
    restoredFromVersion,
    createdAt: isoOf(createdAt),
  };
}

/** The edit history of a published post, and the way back to a state in it. */
export class PostRevisionService {
  constructor(private readonly deps: PostRevisionServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel,
    postId: string,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<PostRevisionPageView, HistoryFailure | InvalidCursor>> {
    const { paginator, revisions } = this.deps;
    const allowed = await this.allowed(user, acting, postId);
    if (isErr(allowed)) return allowed;
    const limit = paginator.limit(query.limit ?? ENTITY_REVISION_KEEP);
    const cursor = decodeRevisionCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await revisions.list('channel_post', postId, {
      beforeVersion: cursor.value,
      limit,
    });
    return andThen(rows, (found) =>
      ok(paginator.paginate(found, limit, { cursorOf: revisionCursorPayload, toItem: toView }))
    );
  }

  /** A normal edit under the caller's version: a stale one is a 409, and a poll with votes keeps its options. */
  async restore(
    user: UserContext,
    acting: ActingChannel,
    postId: string,
    revisionId: string,
    version: number
  ): Promise<
    Result<ManagedPostView, HistoryFailure | PostRevisionNotFound | EditPostServiceFailure>
  > {
    const allowed = await this.allowed(user, acting, postId);
    if (isErr(allowed)) return allowed;
    const revision = await this.deps.revisions.get('channel_post', postId, revisionId);
    if (isErr(revision)) return revision;
    if (!revision.value) return err(postRevisionNotFound(postId, revisionId));

    return this.deps.editor.edit(user, acting, postId, {
      payload: revision.value.snapshot.payload,
      version,
      restoredFromVersion: revision.value.version,
    });
  }

  private async allowed(
    user: UserContext,
    acting: ActingChannel,
    postId: string
  ): Promise<Result<void, HistoryFailure>> {
    const channel = { id: acting.channelId, ownerId: acting.ownerId };
    const permitted = decidePostWrite({ actor: user, action: 'update', channel });
    if (isErr(permitted)) return permitted;
    const found = await this.deps.posts.findById(postId);
    if (isErr(found)) return found;
    const target = decidePostTarget({ post: found.value, postId, channelId: channel.id });
    return isErr(target) ? target : ok();
  }
}
