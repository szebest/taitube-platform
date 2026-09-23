import type { UserRole } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export type UserTier = 'free' | 'pro' | 'enterprise';

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
