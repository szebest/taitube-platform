import type { SavedReplyView } from '@vp/api-contracts';
import type { SavedReplyDraft, SavedReplyRepositoryPort } from '@vp/core/repositories';
import { type ActingChannel, SAVED_REPLY_LIMITS, type SavedReply } from '@vp/domain';
import {
  type AuthorizationFailure,
  type SavedReplyLimit,
  type SavedReplyNotFound,
  decideChannelTask,
  savedReplyLimit,
  savedReplyNotFound,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, err, isErr, map, ok } from '@vp/result';

export interface SavedReplyServiceDeps {
  replies: SavedReplyRepositoryPort;
}

export type ListSavedRepliesFailure = AuthorizationFailure | DatabaseUnavailable;
export type CreateSavedReplyFailure = ListSavedRepliesFailure | SavedReplyLimit;
export type ChangeSavedReplyFailure = ListSavedRepliesFailure | SavedReplyNotFound;

const toView = ({ id, title, body, position }: SavedReply): SavedReplyView => ({
  id,
  title,
  body,
  position,
});

/** Canned inbox replies: the people who moderate read them, the people who change settings write them. */
export class SavedReplyService {
  constructor(private readonly deps: SavedReplyServiceDeps) {}

  async list(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<{ items: SavedReplyView[] }, ListSavedRepliesFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'read-inbox' });
    if (isErr(allowed)) return allowed;

    const rows = await this.deps.replies.list(acting.channelId);
    return map(rows, (found) => ({ items: found.map(toView) }));
  }

  async create(
    user: UserContext,
    acting: ActingChannel,
    draft: SavedReplyDraft
  ): Promise<Result<SavedReplyView, CreateSavedReplyFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const created = await this.deps.replies.create(
      acting.channelId,
      draft,
      SAVED_REPLY_LIMITS.perChannel
    );
    return andThen(created, (reply) =>
      reply ? ok(toView(reply)) : err(savedReplyLimit(SAVED_REPLY_LIMITS.perChannel))
    );
  }

  async update(
    user: UserContext,
    acting: ActingChannel,
    id: string,
    patch: Partial<SavedReplyDraft & { position: number }>
  ): Promise<Result<SavedReplyView, ChangeSavedReplyFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const updated = await this.deps.replies.update(acting.channelId, id, patch);
    return andThen(updated, (reply) => (reply ? ok(toView(reply)) : err(savedReplyNotFound(id))));
  }

  async remove(
    user: UserContext,
    acting: ActingChannel,
    id: string
  ): Promise<Result<void, ChangeSavedReplyFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const removed = await this.deps.replies.remove(acting.channelId, id);
    return andThen(removed, (found) => (found ? ok() : err(savedReplyNotFound(id))));
  }
}
