import { type UpsertUserInput, type UserRecord, UserRepository } from '@vp/core/repositories';

export class InMemoryUserRepository extends UserRepository {
  private readonly usersMap: Map<string, UserRecord>;

  constructor(usersMap: Map<string, UserRecord> = new Map()) {
    super();
    this.usersMap = usersMap;
    if (this.usersMap.size === 0) {
      this.seedDevUsers();
    }
  }

  seedDevUsers(): void {
    this.usersMap.set('00000000-0000-7000-8000-000000000001', {
      id: '00000000-0000-7000-8000-000000000001',
      email: 'dev@video-pipeline.local',
      tier: 'pro',
      role: 'CREATOR',
      maxConcurrentUploads: 10,
      maxVideoDurationSec: 3600,
      storageQuotaBytes: 100 * 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });
    this.usersMap.set('00000000-0000-7000-8000-000000000002', {
      id: '00000000-0000-7000-8000-000000000002',
      email: 'user@video-pipeline.local',
      tier: 'free',
      role: 'USER',
      maxConcurrentUploads: 2,
      maxVideoDurationSec: 300,
      storageQuotaBytes: 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });
    this.usersMap.set('00000000-0000-7000-8000-000000000003', {
      id: '00000000-0000-7000-8000-000000000003',
      email: 'admin@video-pipeline.local',
      tier: 'enterprise',
      role: 'ADMIN',
      maxConcurrentUploads: 50,
      maxVideoDurationSec: 14400,
      storageQuotaBytes: 1024 * 1024 * 1024 * 1024,
      webhookUrl: null,
      createdAt: new Date(),
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersMap.get(id) ?? null;
  }

  async upsert(user: UpsertUserInput): Promise<UserRecord> {
    const existing = this.usersMap.get(user.id);
    if (existing) {
      existing.email = user.email;
      if (user.tier) existing.tier = user.tier;
      if (user.role) existing.role = user.role;
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
      role: user.role ?? 'USER',
      maxConcurrentUploads: user.maxConcurrentUploads ?? 2,
      maxVideoDurationSec: user.maxVideoDurationSec ?? 300,
      storageQuotaBytes: user.storageQuotaBytes ?? 1024 * 1024 * 1024,
      webhookUrl: user.webhookUrl ?? null,
      createdAt: new Date(),
    };
    this.usersMap.set(user.id, record);
    return record;
  }

  clear(): void {
    this.usersMap.clear();
    this.seedDevUsers();
  }
}
