import type { UserRole, UserTier } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface UserRecord {
  id: string;
  email: string;
  tier: UserTier;
  role?: UserRole;
  maxConcurrentUploads?: number;
  maxVideoDurationSec?: number;
  storageQuotaBytes?: number;
  webhookUrl?: string | null;
  createdAt: Date;
}

export interface UpsertUserInput {
  id: string;
  email: string;
  tier?: UserTier;
  role?: UserRole;
  maxConcurrentUploads?: number;
  maxVideoDurationSec?: number;
  storageQuotaBytes?: number;
  webhookUrl?: string | null;
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<Result<UserRecord | null, DatabaseUnavailable>>;
  abstract upsert(user: UpsertUserInput): Promise<Result<UserRecord, DatabaseUnavailable>>;
}
