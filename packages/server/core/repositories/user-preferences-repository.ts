import type { Preferences, UserPreferences } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface SavePreferencesOptions {
  readonly userId: string;
  readonly preferences: Preferences;
  /** 0 when nothing is stored yet; the save bumps it by one. */
  readonly expectedVersion: number;
}

/** One document per account, written whole under optimistic locking on `version`. */
export interface UserPreferencesRepositoryPort {
  find(userId: string): Promise<Result<UserPreferences | null, DatabaseUnavailable>>;
  /** `null` when the stored version is no longer `expectedVersion`, and nothing was written. */
  save(
    options: SavePreferencesOptions
  ): Promise<Result<UserPreferences | null, DatabaseUnavailable>>;
}
