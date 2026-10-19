import type { SavePreferencesOptions, UserPreferencesRepositoryPort } from '@vp/core/repositories';
import type { UserPreferences } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';

export class InMemoryUserPreferencesRepository implements UserPreferencesRepositoryPort {
  private readonly documents = new Map<string, UserPreferences>();

  async find(userId: string): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    return ok(this.documents.get(userId) ?? null);
  }

  async save({
    userId,
    preferences,
    expectedVersion,
  }: SavePreferencesOptions): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    const storedVersion = this.documents.get(userId)?.version ?? 0;
    if (storedVersion !== expectedVersion) return ok(null);

    const saved = { userId, ...preferences, version: storedVersion + 1, updatedAt: new Date() };
    this.documents.set(userId, saved);
    return ok(saved);
  }

  clear(): void {
    this.documents.clear();
  }
}
