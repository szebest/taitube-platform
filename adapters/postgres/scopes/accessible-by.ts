import { videos } from '@vp/db';
import {
  type AppAbility,
  type AppAction,
  type UserContext,
  getUserPermissions,
} from '@vp/permissions';
import { type SQL, eq, or } from 'drizzle-orm';
import type { OwnableAndVisible } from './traits';

/**
 * CASL accessibleBy database scoping adapter for visible/ownable entities.
 * Generates SQL where conditions directly from the user's CASL AppAbility.
 *
 * Inspired by CASL accessibleBy & WebDevSimplified CASL database adapter pattern:
 * - If ability permits unconditional manage all or action on all items: returns undefined.
 * - If authenticated: permits public, unlisted, and records owned by the user.
 * - If guest / unauthenticated: permits only public records.
 */
export function accessibleVideos<TTable extends OwnableAndVisible = OwnableAndVisible>(
  abilityOrUser: AppAbility | UserContext | null,
  action: AppAction = 'read',
  table: TTable = videos as unknown as TTable
): SQL | undefined {
  const ability: AppAbility =
    abilityOrUser !== null && typeof abilityOrUser === 'object' && 'can' in abilityOrUser
      ? abilityOrUser
      : getUserPermissions(abilityOrUser);

  const isUnconditional =
    ability.can('manage', 'all') ||
    ability.rules.some(
      (r) =>
        (r.action === action || r.action === 'manage') &&
        (r.subject === 'Video' || r.subject === 'all') &&
        (!r.conditions || Object.keys(r.conditions).length === 0)
    );

  if (isUnconditional) {
    return undefined;
  }

  const user =
    abilityOrUser !== null &&
    typeof abilityOrUser === 'object' &&
    'id' in abilityOrUser &&
    'role' in abilityOrUser
      ? (abilityOrUser as UserContext)
      : null;

  if (!user || user.role === 'GUEST') {
    return eq(table.visibility, 'public');
  }

  return or(
    eq(table.visibility, 'public'),
    eq(table.visibility, 'unlisted'),
    eq(table.ownerId, user.id)
  );
}

/**
 * Universal accessibleBy adapter entrypoint for Drizzle queries.
 */
export function accessibleBy(
  abilityOrUser: AppAbility | UserContext | null,
  subject: 'Video',
  action: AppAction = 'read'
): SQL | undefined {
  if (subject === 'Video') {
    return accessibleVideos(abilityOrUser, action);
  }
  return undefined;
}

/**
 * Row-level authorization scope for reading videos.
 * Evaluates permissions directly using @vp/permissions via accessibleVideos adapter.
 */
export function videoReadScope(userOrAbility: UserContext | AppAbility | null): SQL | undefined {
  return accessibleVideos(userOrAbility, 'read', videos);
}

/**
 * Row-level scope restricting video queries strictly to the owner.
 * Accepts either a UserContext or an owner ID string.
 */
export function videoOwnerScope(owner: UserContext | string): SQL {
  const ownerId = typeof owner === 'string' ? owner : owner.id;
  return eq(videos.ownerId, ownerId);
}
