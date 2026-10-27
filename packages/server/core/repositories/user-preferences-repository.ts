import type { PreferenceSection, Preferences, UserPreferences } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface SavePreferencesOptions {
  readonly userId: string;
  readonly preferences: Preferences;
  /** 0 when nothing is stored yet; the save bumps it by one. */
  readonly expectedVersion: number;
  /** Announced with the new version on the owner's user stream, in the same transaction as the save. */
  readonly sections: PreferenceSection[];
}

/** One document per account, written whole under optimistic locking on `version`. */
export interface UserPreferencesRepositoryPort {
  find(userId: string): Promise<Result<UserPreferences | null, DatabaseUnavailable>>;
  /** One read for a batch of accounts; one that never saved is absent from the answer. */
  findMany(userIds: readonly string[]): Promise<Result<UserPreferences[], DatabaseUnavailable>>;
  /** `null` when the stored version is no longer `expectedVersion`, and nothing was written. */
  save(
    options: SavePreferencesOptions
  ): Promise<Result<UserPreferences | null, DatabaseUnavailable>>;
}
