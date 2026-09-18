export interface Channel {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChannelInput {
  id?: string;
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  subscriberCount?: number;
}

export interface UpdateChannelInput {
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
}

export const HANDLE_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;

export const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'system',
  'studio',
  'feed',
  'root',
  'me',
  'user',
  'users',
  'channel',
  'channels',
  'video',
  'videos',
  'upload',
  'uploads',
  'settings',
  'dashboard',
  'explore',
  'subscriptions',
  'trending',
  'help',
  'terms',
  'privacy',
  'status',
  'login',
  'logout',
  'auth',
  'v1',
  'v2',
  'metrics',
  'healthz',
  'readyz',
  'docs',
  'swagger',
]);

export function isValidHandleFormat(handle: string): boolean {
  return HANDLE_REGEX.test(handle);
}

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}

export function normalizeHandle(handle: string): string {
  const clean = handle.startsWith('@') ? handle.slice(1) : handle;
  return clean.toLowerCase().trim();
}
