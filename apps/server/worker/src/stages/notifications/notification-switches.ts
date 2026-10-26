import type { Repositories } from '@vp/core/repositories';
import { KIND_SWITCH, type NotificationKind } from '@vp/domain';
import { DEFAULT_PREFERENCES } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, map } from '@vp/result';

/** The users, among `userIds`, whose account switch lets `kind` through; an unsaved account is on defaults. */
export async function usersSwitchedOn(
  repositories: Pick<Repositories, 'userPreferences'>,
  userIds: readonly string[],
  kind: NotificationKind
): Promise<Result<Set<string>, DatabaseUnavailable>> {
  const key = KIND_SWITCH[kind];
  const saved = await repositories.userPreferences.findMany(userIds);

  return map(saved, (documents) => {
    const switchOf = new Map(
      documents.map((document) => [
        document.userId,
        (document.notifications ?? DEFAULT_PREFERENCES.notifications)[key],
      ])
    );
    const defaultOn = DEFAULT_PREFERENCES.notifications[key];
    return new Set(userIds.filter((userId) => switchOf.get(userId) ?? defaultOn));
  });
}
