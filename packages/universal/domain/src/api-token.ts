import { MS_PER_DAY } from '@vp/domain/time';

/** What a personal access token may touch; each one maps to abilities in `@vp/permissions`. */
export const API_SCOPES = [
  'videos:read',
  'videos:write',
  'analytics:read',
  'comments:read',
  'comments:moderate',
  'exports:read',
  'exports:create',
  'webhooks:manage',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Never unlimited, so a leaked token ages out. */
export const API_TOKEN_EXPIRIES = { '30d': 30, '90d': 90, '1y': 365 } as const;

export type ApiTokenExpiry = keyof typeof API_TOKEN_EXPIRIES;

export const DEFAULT_API_TOKEN_EXPIRY: ApiTokenExpiry = '90d';

export const API_TOKEN_LIMITS = {
  activePerUser: 10,
  nameMaxLength: 60,
  requestsPerMinute: 60,
} as const;

export const API_TOKEN_STATUSES = ['active', 'expired', 'revoked'] as const;

export type ApiTokenStatus = (typeof API_TOKEN_STATUSES)[number];

/**
 * `API_TOKEN` in `@vp/domain-rules` is the machine over these edges. `expire` is the clock passing
 * `expiresAt`, never a write; an expired token can still be revoked, which takes it off the list.
 */
export const API_TOKEN_EDGES = {
  use: { from: ['active'], to: 'active' },
  expire: { from: ['active'], to: 'expired' },
  revoke: { from: ['active', 'expired'], to: 'revoked' },
} as const satisfies Record<string, { from: readonly ApiTokenStatus[]; to: ApiTokenStatus }>;

export interface ApiToken {
  id: string;
  userId: string;
  channelId: string;
  name: string;
  /** Shown in lists and used to find the row; the secret is never stored, only its SHA-256. */
  prefix: string;
  secretHash: string;
  scopes: ApiScope[];
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** A token as its list shows it, with the requests it made today (UTC). */
export interface ApiTokenSummary extends Omit<ApiToken, 'secretHash'> {
  requestsToday: number;
}

export function apiTokenStatus(
  { revokedAt, expiresAt }: Pick<ApiToken, 'revokedAt' | 'expiresAt'>,
  now: Date
): ApiTokenStatus {
  if (revokedAt) return 'revoked';
  return expiresAt.getTime() <= now.getTime() ? 'expired' : 'active';
}

export function apiTokenExpiry(expiry: ApiTokenExpiry, createdAt: Date): Date {
  return new Date(createdAt.getTime() + API_TOKEN_EXPIRIES[expiry] * MS_PER_DAY);
}

const TOKEN_PATTERN = /^tt_pat_([0-9a-f]{8})_([0-9a-f]{64})$/;

/** The 8 hex characters shown in lists and the 32 random bytes in hex, which only the creator ever sees. */
export interface ApiTokenParts {
  prefix: string;
  secret: string;
}

export function formatApiToken({ prefix, secret }: ApiTokenParts): string {
  return `tt_pat_${prefix}_${secret}`;
}

/** `null` for anything that is not exactly the shape `formatApiToken` writes. */
export function parseApiToken(credential: string): ApiTokenParts | null {
  const match = TOKEN_PATTERN.exec(credential);
  if (!match?.[1] || !match[2]) return null;
  return { prefix: match[1], secret: match[2] };
}

/** Whether a bearer credential claims to be a personal access token, well formed or not. */
export function isApiTokenCredential(credential: string): boolean {
  return credential.startsWith('tt_pat_');
}
