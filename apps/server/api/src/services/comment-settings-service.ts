import type { CommentSettingsView } from '@vp/api-contracts';
import type { CommentSettingsRepositoryPort } from '@vp/core/repositories';
import {
  type ActingChannel,
  COMMENT_SETTINGS_FIELDS,
  type CommentSettings,
  type CommentSettingsField,
} from '@vp/domain';
import { type AuthorizationFailure, decideChannelTask } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, isErr, ok } from '@vp/result';
import { type InvalidCommentSettings, validateCommentSettings } from '@vp/validation';

export interface CommentSettingsServiceDeps {
  settings: CommentSettingsRepositoryPort;
}

export type ReadCommentSettingsFailure = AuthorizationFailure | DatabaseUnavailable;
export type UpdateCommentSettingsFailure = ReadCommentSettingsFailure | InvalidCommentSettings;

function toView(settings: CommentSettings): CommentSettingsView {
  return {
    ...settings,
    blockedWords: [...settings.blockedWords],
    linkAllowlist: [...settings.linkAllowlist],
  };
}

const changedFields = (before: CommentSettings, after: CommentSettings) =>
  COMMENT_SETTINGS_FIELDS.filter(
    (field: CommentSettingsField) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
  );

/** The comment settings of the acting channel: owner and managers read and replace them. */
export class CommentSettingsService {
  constructor(private readonly deps: CommentSettingsServiceDeps) {}

  async get(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<CommentSettingsView, ReadCommentSettingsFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const current = await this.deps.settings.get(acting.channelId);
    return isErr(current) ? current : ok(toView(current.value));
  }

  async update(
    user: UserContext,
    acting: ActingChannel,
    body: CommentSettingsView
  ): Promise<Result<CommentSettingsView, UpdateCommentSettingsFailure>> {
    const allowed = decideChannelTask({ user, acting, task: 'edit-comment-settings' });
    if (isErr(allowed)) return allowed;

    const validated = validateCommentSettings(body);
    if (isErr(validated)) return validated;
    const next: CommentSettings = { ...body, ...validated.value };

    const current = await this.deps.settings.get(acting.channelId);
    if (isErr(current)) return current;
    const fields = changedFields(current.value, next);
    if (fields.length === 0) return ok(toView(current.value));

    const saved = await this.deps.settings.save(acting.channelId, next, {
      channelId: acting.channelId,
      actorUserId: user.id,
      action: 'settings.comments.updated',
      targetType: 'settings',
      targetId: acting.channelId,
      meta: { fields },
    });
    return andThen(saved, (settings) => ok(toView(settings)));
  }
}
