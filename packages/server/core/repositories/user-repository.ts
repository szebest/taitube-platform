export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
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
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract upsert(user: UpsertUserInput): Promise<UserRecord>;
}
