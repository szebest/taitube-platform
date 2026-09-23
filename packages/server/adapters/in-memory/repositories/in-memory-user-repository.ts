import { type UpsertUserInput, type UserRecord, UserRepository } from '@vp/core/repositories';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export class InMemoryUserRepository extends UserRepository {
  private readonly usersMap = new Map<string, UserRecord>();

  constructor() {
    super();
    this.seedDevUsers();
  }

  seedDevUsers(): void {
    this.usersMap.set('00000000-0000-7000-8000-000000000001', {
      id: '00000000-0000-7000-8000-000000000001',
      email: 'dev@video-pipeline.local',
      tier: 'pro',
      role: 'CREATOR',
      webhookUrl: null,
      createdAt: new Date(),
    });
    this.usersMap.set('00000000-0000-7000-8000-000000000002', {
      id: '00000000-0000-7000-8000-000000000002',
      email: 'user@video-pipeline.local',
      tier: 'free',
      role: 'USER',
      webhookUrl: null,
      createdAt: new Date(),
    });
  }

  async findById(id: string): Promise<Result<UserRecord | null, DatabaseUnavailable>> {
    return ok(this.usersMap.get(id) ?? null);
  }

  async upsert(user: UpsertUserInput): Promise<Result<UserRecord, DatabaseUnavailable>> {
    const existing = this.usersMap.get(user.id);
    if (existing) {
      existing.email = user.email;
      if (user.tier) existing.tier = user.tier;
      if (user.role) existing.role = user.role;
      if (user.webhookUrl !== undefined) existing.webhookUrl = user.webhookUrl;
      return ok(existing);
    }
    const record: UserRecord = {
      id: user.id,
      email: user.email,
      tier: user.tier ?? 'free',
      role: user.role ?? 'USER',
      webhookUrl: user.webhookUrl ?? null,
      createdAt: new Date(),
    };
    this.usersMap.set(user.id, record);
    return ok(record);
  }

  clear(): void {
    this.usersMap.clear();
    this.seedDevUsers();
  }
}
