import { InMemoryCommentSlowMode, type InMemoryRepositories } from '@vp/adapters/in-memory';
import type { CommentSettings } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import type { CommentCreateDeps } from '../comment-create';

/** Everything creating a comment reads, over the in-memory stores and a clock the test owns. */
export function commentCreateDeps(
  repositories: InMemoryRepositories,
  now: () => number = Date.now
): CommentCreateDeps {
  return {
    comments: repositories.comments,
    videos: repositories.videos,
    channels: repositories.channels,
    members: repositories.channelMembers,
    settings: repositories.commentSettings,
    restrictions: repositories.channelUserRestrictions,
    trusted: repositories.trustedCommenters,
    subscriptions: repositories.subscriptions,
    users: repositories.users,
    slowMode: new InMemoryCommentSlowMode(now),
    now,
  };
}

export async function saveSettings(
  repositories: InMemoryRepositories,
  channelId: string,
  settings: CommentSettings
): Promise<void> {
  expectOk(
    await repositories.commentSettings.save(channelId, settings, {
      channelId,
      actorUserId: '11111111-1111-7111-8111-111111111111',
      action: 'settings.comments.updated',
      targetType: 'settings',
      targetId: channelId,
      meta: { fields: [] },
    })
  );
}
