export const VALID_ROLES = ['GUEST', 'USER', 'CREATOR', 'MODERATOR', 'ADMIN'] as const;
export type Role = (typeof VALID_ROLES)[number];
const ROLES_SET = new Set<Role>(VALID_ROLES);

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
}
