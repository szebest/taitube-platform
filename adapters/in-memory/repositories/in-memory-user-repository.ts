import { type UpsertUserInput, type UserRecord, UserRepository } from '@vp/core/ports';

export class InMemoryUserRepository extends UserRepository {
  constructor(private readonly usersMap: Map<string, UserRecord>) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersMap.get(id) ?? null;
  }

  async upsert(user: UpsertUserInput): Promise<UserRecord> {
    const existing = this.usersMap.get(user.id);
    if (existing) {
      existing.email = user.email;
      if (user.tier) existing.tier = user.tier;
      if (user.maxConcurrentUploads !== undefined)
        existing.maxConcurrentUploads = user.maxConcurrentUploads;
      if (user.maxVideoDurationSec !== undefined)
        existing.maxVideoDurationSec = user.maxVideoDurationSec;
      if (user.storageQuotaBytes !== undefined) existing.storageQuotaBytes = user.storageQuotaBytes;
      if (user.webhookUrl !== undefined) existing.webhookUrl = user.webhookUrl;
      return existing;
    }
    const record: UserRecord = {
      id: user.id,
      email: user.email,
      tier: user.tier ?? 'free',
      maxConcurrentUploads: user.maxConcurrentUploads ?? 2,
      maxVideoDurationSec: user.maxVideoDurationSec ?? 300,
      storageQuotaBytes: user.storageQuotaBytes ?? 1024 * 1024 * 1024,
      webhookUrl: user.webhookUrl ?? null,
      createdAt: new Date(),
    };
    this.usersMap.set(user.id, record);
    return record;
  }
}
