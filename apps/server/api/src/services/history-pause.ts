import type { UserPreferencesRepositoryPort } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { map, type Result } from '@vp/result';

/** The one reader of `privacy.historyPaused`, which pauses watch history and search history alike. */
export class HistoryPause {
  constructor(private readonly preferences: UserPreferencesRepositoryPort) {}

  async isPaused(userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const preferences = await this.preferences.find(userId);
    return map(preferences, (found) => found?.privacy?.historyPaused ?? false);
  }
}
