import { videos } from '@vp/db';
import {
  type AppAbility,
  type AppAction,
  type AppSubjects,
  type UserContext,
  getUserPermissions,
} from '@vp/permissions';
import { type SQL, eq } from 'drizzle-orm';
import type { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { abilityToSql } from './rules-to-sql';

function toAbility(abilityOrUser: AppAbility | UserContext | null): AppAbility {
  if (abilityOrUser !== null && 'can' in abilityOrUser) {
    return abilityOrUser;
  }
  return getUserPermissions(abilityOrUser);
}

/**
 * Row-level scope for any subject backed by a Drizzle table, compiled from the user's CASL rules.
 * Returns undefined when the rules impose no restriction.
 */
export function accessibleBy<T extends TableConfig>(
  abilityOrUser: AppAbility | UserContext | null,
  subject: AppSubjects,
  table: PgTableWithColumns<T>,
  action: AppAction = 'read'
): SQL | undefined {
  return abilityToSql(toAbility(abilityOrUser), action, subject, table);
}

export function videoReadScope(userOrAbility: UserContext | AppAbility | null): SQL | undefined {
  return accessibleBy(userOrAbility, 'Video', videos, 'read');
}

export function videoOwnerScope(owner: UserContext | string): SQL {
  return eq(videos.ownerId, typeof owner === 'string' ? owner : owner.id);
}
