import type {
  SavePreferencesOptions,
  UserEventRepository,
  UserPreferencesRepositoryPort,
} from '@vp/core/repositories';
import { preferencesUpdated } from '@vp/domain';
import type { UserPreferences } from '@vp/domain/settings';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';

export class InMemoryUserPreferencesRepository implements UserPreferencesRepositoryPort {
  private readonly documents = new Map<string, UserPreferences>();

  constructor(private readonly userEvents: UserEventRepository) {}

  async find(userId: string): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    return ok(this.documents.get(userId) ?? null);
  }

  async findMany(
    userIds: readonly string[]
  ): Promise<Result<UserPreferences[], DatabaseUnavailable>> {
    return ok(userIds.flatMap((userId) => this.documents.get(userId) ?? []));
  }

  async save({
    userId,
    preferences,
    expectedVersion,
    sections,
  }: SavePreferencesOptions): Promise<Result<UserPreferences | null, DatabaseUnavailable>> {
    const storedVersion = this.documents.get(userId)?.version ?? 0;
    if (storedVersion !== expectedVersion) return ok(null);

    const saved = { userId, ...preferences, version: storedVersion + 1, updatedAt: new Date() };
    this.documents.set(userId, saved);
    const announced = await this.userEvents.append({
      userId,
      ...preferencesUpdated(sections, saved.version),
    });
    return isErr(announced) ? announced : ok(saved);
  }

  clear(): void {
    this.documents.clear();
  }
}
