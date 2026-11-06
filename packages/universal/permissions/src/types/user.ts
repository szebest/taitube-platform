import type { ChannelRole } from '@vp/domain';

export const ROLES = ['GUEST', 'USER', 'CREATOR', 'MODERATOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
const ROLES_SET: ReadonlySet<Role> = new Set<Role>(ROLES);

const SIGNED_IN_ROLES = ['USER', 'CREATOR', 'MODERATOR', 'ADMIN'] as const;
const SIGNED_IN_ROLES_SET: ReadonlySet<Role> = new Set<Role>(SIGNED_IN_ROLES);

export function isSignedInRole(role: Role): boolean {
  return SIGNED_IN_ROLES_SET.has(role);
}

/**
 * Boundary parser to safely construct a strictly-typed Role from untrusted external input (JWT, header, etc.).
 * Domain rules and ability builders MUST consume strongly-typed Role directly.
 */
export function parseRole(value: unknown): Role {
  if (typeof value === 'string') {
    const upper = value.toUpperCase() as Role;
    if (ROLES_SET.has(upper)) {
      return upper;
    }
  }
  return 'GUEST';
}

export interface UserContext {
  readonly id: string;
  readonly role: Role;
  readonly email?: string;
  /** Channel id to the caller's role there and the channel owner's user id; loaded per request. */
  readonly memberships?: Readonly<Record<string, ChannelGrant>>;
}

export interface ChannelGrant {
  readonly role: ChannelRole;
  readonly ownerId: string;
}
